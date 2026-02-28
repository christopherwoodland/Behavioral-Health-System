using System.Reflection;
var asm = typeof(Microsoft.Azure.Functions.Worker.Http.HttpResponseDataExtensions).Assembly;
var type = asm.GetType("Microsoft.Azure.Functions.Worker.Http.HttpResponseDataExtensions");
// Get GetObjectSerializer method
var method = type.GetMethod("GetObjectSerializer", BindingFlags.NonPublic | BindingFlags.Static);
if (method == null) { Console.WriteLine("Method not found"); return; }
Console.WriteLine($"Return type: {method.ReturnType.FullName}");
Console.WriteLine($"Parameters: {string.Join(", ", method.GetParameters().Select(p => $"{p.ParameterType.FullName} {p.Name}"))}");
// Get IL body to understand logic
var body = method.GetMethodBody();
if (body != null) {
    Console.WriteLine($"IL size: {body.GetILAsByteArray()?.Length} bytes");
    Console.WriteLine($"Local vars: {string.Join(", ", body.LocalVariables.Select(v => v.LocalType.FullName))}");
}

// Also check the simplest WriteAsJsonAsync - the one taking (response, instance, cancellation)
var writeMethod = type.GetMethods(BindingFlags.Public | BindingFlags.Static)
    .Where(m => m.Name == "WriteAsJsonAsync")
    .OrderBy(m => m.GetParameters().Length)
    .First();
Console.WriteLine($"\nSimplest WriteAsJsonAsync: {writeMethod.GetParameters().Length} params");
var wBody = writeMethod.GetMethodBody();
Console.WriteLine($"IL size: {wBody?.GetILAsByteArray()?.Length} bytes");
