using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Web.Filters;
using CampusLogicEvents.Web.Models;

namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class EventPropertyController : ApiController
    {
        
        /// <summary>
        /// Get the latest EventProperties from PM and backup to CL local db.
        /// If PM is unavailable, use the values in the CL local db.
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public HttpResponseMessage UpdateEventProperties()
        {
            try
            {
                EventPropertyService.UpdateEventPropertyData();
                return Request.CreateResponse(HttpStatusCode.OK);
            }
            catch (Exception e)
            {
                LogManager.ErrorLogFormat("EventPropertyController UpdateEventProperties Error: {0}", e);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Get the latest EventProperties from PM and backup to CL local db.
        /// If PM is unavailable, use the values in the CL local db.
        /// Uses specified credentials instead of web.config
        /// </summary>
        /// <param name="username"></param>
        /// <param name="password"></param>
        /// <param name="environment"></param>
        /// <returns></returns>
        [HttpPost]
        public HttpResponseMessage UpdateEventPropertiesWithCredentials(string username, string password,
            string environment)
        {
            try
            {
                EventPropertyService.UpdateEventPropertyData(username, password, environment);
                return Request.CreateResponse(HttpStatusCode.OK);
            }
            catch (Exception e)
            {
                LogManager.ErrorLogFormat("EventPropertyController UpdateEventPropertiesWithCredentials Error: {0}", e);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Get the current Event Property Display Names from EventPropertyManager
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public HttpResponseMessage GetEventPropertyDisplayNames()
        {
            try
            {
                List<string> properties = EventPropertyManager.Instance.GetPropertyDisplayNames();
                return Request.CreateResponse(HttpStatusCode.OK, properties);
            }
            catch (Exception e)
            {
                LogManager.ErrorLogFormat("EventPropertyController GetEventProperties Error: {0}", e);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }
    }
}