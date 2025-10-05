namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class PredictErrorTests
    {
        [TestMethod]
        public void PredictError_Constructor_Succeeds()
        {
            var model = new PredictError();
            Assert.IsNotNull(model);
        }
    }
}
