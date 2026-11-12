using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using CampusLogicEvents.Web.Filters;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class DatabaseController : ApiController
    {
        public DatabaseController()
        {
        }

        [HttpGet]
        public HttpResponseMessage GetInfo()
        {
            try
            {
                var dbInfo = ClientDatabaseManager.GetDatabaseInfo();
                return Request.CreateResponse(HttpStatusCode.OK, dbInfo);
            }
            catch (Exception ex)
            {
                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, ex.Message);
            }
        }
    }
}