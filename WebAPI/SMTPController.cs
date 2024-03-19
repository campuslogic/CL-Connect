using CampusLogicEvents.Implementation.Models;
using CampusLogicEvents.Web.Filters;
using CampusLogicEvents.Web.Models;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;


namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class SMTPController : ApiController
    {
        /// <summary>
        /// Testing the SMTP information
        /// entered through the setup 
        /// wizard
        /// </summary>
        /// <param name="smtpTest"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<HttpResponseMessage> TestSMTP(SMTPTest smtpTest)
        {
            await NotificationService.ErrorNotification(smtpTest.smtpSection, smtpTest.sendTo);
            return Request.CreateResponse(HttpStatusCode.OK);
        }
    }
}