using System.Collections;
using BehavioralHealthSystem.Functions.Services;
using Castle.DynamicProxy;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class EasyAuthAuthorizationMiddlewareTests
{
    [TestMethod]
    public async Task Invoke_ProtectedRequestWithRequiredScope_CallsNext()
    {
        var fixture = CreateFixture("POST", "/api/initiate");
        fixture.ValidationService
            .Setup(service => service.ValidateRequestAsync(fixture.Request))
            .ReturnsAsync(new TokenValidationResult { IsValid = true });
        var nextCalled = false;

        await fixture.Middleware.Invoke(fixture.Context, _ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        Assert.IsTrue(nextCalled);
        fixture.ValidationService.Verify(
            service => service.ValidateRequestAsync(fixture.Request),
            Times.Once);
    }

    [TestMethod]
    public async Task Invoke_ProtectedRequestWithoutRequiredScope_ReturnsForbidden()
    {
        var fixture = CreateFixture("GET", "/api/sessions");
        fixture.ValidationService
            .Setup(service => service.ValidateRequestAsync(fixture.Request))
            .ReturnsAsync(new TokenValidationResult
            {
                IsValid = false,
                FailureStatusCode = HttpStatusCode.Forbidden,
                ErrorMessage = "The access_as_user delegated scope is required."
            });
        var nextCalled = false;

        await fixture.Middleware.Invoke(fixture.Context, _ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        Assert.IsFalse(nextCalled);
        var response = fixture.InvocationResult as HttpResponseData;
        Assert.IsNotNull(response);
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
        response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(response.Body);
        Assert.AreEqual(
            "The access_as_user delegated scope is required.",
            body.RootElement.GetProperty("error").GetString());
    }

    [TestMethod]
    [DataRow("/api/health")]
    [DataRow("/api/health/")]
    [DataRow("/api/feature-flags")]
    [DataRow("/api/feature-flags/transcription")]
    public async Task Invoke_PublicPath_SkipsAuthorization(string path)
    {
        var fixture = CreateFixture("GET", path);
        var nextCalled = false;

        await fixture.Middleware.Invoke(fixture.Context, _ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        Assert.IsTrue(nextCalled);
        fixture.ValidationService.Verify(
            service => service.ValidateRequestAsync(It.IsAny<HttpRequestData>()),
            Times.Never);
    }

    [TestMethod]
    public async Task Invoke_OptionsRequest_SkipsAuthorization()
    {
        var fixture = CreateFixture("OPTIONS", "/api/initiate");
        var nextCalled = false;

        await fixture.Middleware.Invoke(fixture.Context, _ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        Assert.IsTrue(nextCalled);
        fixture.ValidationService.Verify(
            service => service.ValidateRequestAsync(It.IsAny<HttpRequestData>()),
            Times.Never);
    }

    private static MiddlewareFixture CreateFixture(string method, string path)
    {
        var features = new TestInvocationFeatures();
        var bindingsInterceptor = new FunctionBindingsInterceptor();
        var bindingsFeatureType = typeof(FunctionContext).Assembly.GetType(
            "Microsoft.Azure.Functions.Worker.Context.Features.IFunctionBindingsFeature",
            throwOnError: true)!;
        var bindingsFeature = new ProxyGenerator().CreateInterfaceProxyWithoutTarget(
            bindingsFeatureType,
            bindingsInterceptor);
        features.Set(bindingsFeatureType, bindingsFeature);

        var context = new Mock<FunctionContext>();
        context.SetupGet(value => value.Features).Returns(features);

        var response = new Mock<HttpResponseData>(MockBehavior.Loose, context.Object);
        response.SetupProperty(value => value.StatusCode, HttpStatusCode.OK);
        response.SetupGet(value => value.Headers).Returns(new HttpHeadersCollection());
        response.SetupGet(value => value.Body).Returns(new MemoryStream());

        var request = new Mock<HttpRequestData>(MockBehavior.Loose, context.Object);
        request.SetupGet(value => value.Method).Returns(method);
        request.SetupGet(value => value.Url).Returns(new Uri($"https://localhost{path}"));
        request.SetupGet(value => value.Headers).Returns(new HttpHeadersCollection());
        request.Setup(value => value.CreateResponse()).Returns(response.Object);

        var httpFeature = new Mock<IHttpRequestDataFeature>();
        httpFeature
            .Setup(value => value.GetHttpRequestDataAsync(context.Object))
            .ReturnsAsync(request.Object);
        features.Set<IHttpRequestDataFeature>(httpFeature.Object);

        var validationService = new Mock<IApiKeyValidationService>(MockBehavior.Strict);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WEBSITE_AAD_ENABLE_MISE"] = "true"
            })
            .Build();
        var middleware = new EasyAuthAuthorizationMiddleware(
            validationService.Object,
            configuration,
            Mock.Of<ILogger<EasyAuthAuthorizationMiddleware>>());

        return new MiddlewareFixture(
            context.Object,
            request.Object,
            validationService,
            middleware,
            bindingsInterceptor);
    }

    private sealed record MiddlewareFixture(
        FunctionContext Context,
        HttpRequestData Request,
        Mock<IApiKeyValidationService> ValidationService,
        EasyAuthAuthorizationMiddleware Middleware,
        FunctionBindingsInterceptor BindingsInterceptor)
    {
        public object? InvocationResult => BindingsInterceptor.InvocationResult;
    }

    private sealed class TestInvocationFeatures : IInvocationFeatures
    {
        private readonly Dictionary<Type, object> _features = new();

        public T? Get<T>()
        {
            return _features.TryGetValue(typeof(T), out var value) ? (T)value : default;
        }

        public void Set<T>(T instance)
        {
            if (instance is null)
            {
                _features.Remove(typeof(T));
                return;
            }

            _features[typeof(T)] = instance;
        }

        public void Set(Type type, object instance)
        {
            _features[type] = instance;
        }

        public IEnumerator<KeyValuePair<Type, object>> GetEnumerator()
        {
            return _features.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }
    }

    private sealed class FunctionBindingsInterceptor : IInterceptor
    {
        public object? InvocationResult { get; private set; }

        public void Intercept(Castle.DynamicProxy.IInvocation invocation)
        {
            if (invocation.Method.Name == "get_InvocationResult")
            {
                invocation.ReturnValue = InvocationResult;
            }
            else if (invocation.Method.Name == "set_InvocationResult")
            {
                InvocationResult = invocation.Arguments[0];
            }
            else if (invocation.Method.ReturnType != typeof(void))
            {
                invocation.ReturnValue = invocation.Method.ReturnType.IsValueType
                    ? Activator.CreateInstance(invocation.Method.ReturnType)
                    : null;
            }
        }
    }
}
