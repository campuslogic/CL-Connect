using System.Security;
using System.Web.Mvc;

namespace CampusLogicEvents.Web.Controllers
{
    public class SetupController : Controller
    {
        public ActionResult ApplicationSettings()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult Credentials()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult Environment()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult EventNotifications()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult SaveConfigurations()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult smtp()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult IsirUpload()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }


        public ActionResult ISIRCorrection()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult StoredProcedure()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }
        public ActionResult AwardLetterUpload()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult AwardLetterFileMappingUpload()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult DataFileUpload()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult DocumentImports()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult Document()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult FileStore()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }


        public ActionResult AwardLetterPrint()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult BatchProcessing()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult ApiIntegration()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

		public ActionResult BulkAction()
		{
			if (!Request.IsLocal)
			{
				throw new SecurityException("This is only available locally.");
			}

			return PartialView();
		}

        public ActionResult FileDefinitions()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        public ActionResult PowerFAIDS()
        {
            if (!Request.IsLocal)
            {
                throw new SecurityException("This is only available locally.");
            }

            return PartialView();
        }

        /// <summary>
        /// Gets the template with the specified name.
        /// </summary>
        /// <param name="templateName">The name of the template to get.</param>
        /// <returns>The matching template.</returns>
        public ActionResult Template(string templateName)
        {
            return PartialView(templateName);
        }
    }
}
