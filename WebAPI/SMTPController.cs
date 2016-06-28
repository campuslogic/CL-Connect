﻿using CampusLogicEvents.Implementation.Models;
using CampusLogicEvents.Web.Models;
using System.Net;
using System.Net.Http;
using System.Web.Http;


namespace CampusLogicEvents.Web.WebAPI
{
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
        public HttpResponseMessage TestSMTP(SMTPTest smtpTest)
        {
            NotificationService.ErrorNotification(smtpTest.smtpSection, smtpTest.sendTo);
            return Request.CreateResponse(HttpStatusCode.OK);
        }
    }
}