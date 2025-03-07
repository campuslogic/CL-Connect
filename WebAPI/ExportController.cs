using CampusLogicEvents.Implementation;
using CampusLogicEvents.Web.Filters;
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;


namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class ExportController : ApiController
    {
        public ExportController()
        {
        }

        [HttpPost]
        [Route("api/Export/ExportLogs")]
        public HttpResponseMessage ExportLogs([FromBody] ExportRequest request)
        {
            var test = ClientDatabaseManager.GetDatabaseSize();
            var exportManager = new ExportManager();
            try
            {
                exportManager.ExportLogs(request.Days, request.Tables);
            }
            catch (Exception ex)
            {

                throw;
            }

            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("Logs exported successfully")
            };
            return response;
        }
    }

    public class ExportRequest
    {
        public int Days { get; set; }
        public List<string> Tables { get; set; }
    }
}