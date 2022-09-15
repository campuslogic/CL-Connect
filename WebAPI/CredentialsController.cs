using System.Net.Http;
using System.Web.Http;
using CampusLogicEvents.Implementation;
using System;
using System.Net;
using System.Collections.Generic;
using System.Configuration;
using CampusLogicEvents.Implementation.Configurations;
using Microsoft.Ajax.Utilities;
using CampusLogicEvents.Web.Filters;
using System.Threading.Tasks;

namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class CredentialsController : ApiController
    {
        public CredentialsController()
        {
        }

        [HttpGet]
        public async Task<HttpResponseMessage> TestAPICredentials(string username, string password, string environment)
        {
            try
            {
                string apiURL = CredentialsManager.GetGwApiUrl(environment);
                HttpResponseMessage response = await CredentialsManager.GetOAuth2TokenAsync(username, password, apiURL, environment);

                return response;
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestAPICredentials Get Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }
    }
}