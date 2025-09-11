using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class KintsugiWorkflowResultTests
    {
        [TestMethod]
        public void KintsugiWorkflowResult_Constructor_Succeeds()
        {
            var model = new KintsugiWorkflowResult();
            Assert.IsNotNull(model);
        }
    }
}
