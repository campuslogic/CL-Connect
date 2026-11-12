using System.Security;
using System.Web.Mvc;
using CampusLogicEvents.Web.Models;

namespace CampusLogicEvents.Web.Controllers
{
	public class HomeController : Controller
    {
        public ActionResult Index()
        {
            return View();
        }

        public ActionResult Menu()
        {
            return PartialView();
        }

        public ActionResult Log(int count = 100)
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            var logData = DataService.LogRecords(count);

            return View(logData);
        }

        public ActionResult Events(int count = 100)
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            var eventData = DataService.EventRecords(count);

            return View(eventData);
        }

        public ActionResult Export()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }
    }
}
