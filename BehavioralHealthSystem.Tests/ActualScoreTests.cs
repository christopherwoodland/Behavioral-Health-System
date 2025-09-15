using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class ActualScoreTests
    {
        [TestMethod]
        public void ActualScore_Constructor_Succeeds()
        {
            var model = new ActualScore();
            Assert.IsNotNull(model);
        }
    }
}
