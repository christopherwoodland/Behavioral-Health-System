using System.Reflection;
using BehavioralHealthSystem.Dam.Services;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class LocalDamWarmupHostedServiceTests
{
    [DataTestMethod]
    [DataRow("{\"status\":\"healthy\",\"model_loaded\":true,\"mock_mode\":false}", true)]
    [DataRow("{\"status\":\"healthy\",\"model_loaded\":false,\"mock_mode\":false}", false)]
    [DataRow("{\"status\":\"ok\",\"pipeline\":\"loaded\"}", true)]
    [DataRow("{\"status\":\"loading\",\"model_loaded\":true}", false)]
    [DataRow("{\"status\":\"healthy\"}", false)]
    public void IsPipelineLoaded_RecognizesSupportedHealthContracts(string json, bool expected)
    {
        var method = typeof(LocalDamWarmupHostedService).GetMethod(
            "IsPipelineLoaded",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.IsNotNull(method);
        Assert.AreEqual(expected, method.Invoke(null, new object[] { json }));
    }
}
