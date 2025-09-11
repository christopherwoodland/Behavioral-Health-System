using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class KintsugiWorkflowInputTests
    {
        [TestMethod]
        public void KintsugiWorkflowInput_Constructor_Succeeds()
        {
            var model = new KintsugiWorkflowInput();
            Assert.IsNotNull(model);
        }
    }
}
