using System.Web.Http;
using System.Web.Http.Controllers;

namespace CampusLogicEvents.Web.Filters
{
    public class LocalRequestOnlyAttribute : AuthorizeAttribute
    {
        protected override bool IsAuthorized(HttpActionContext context)
        {
            return context.RequestContext.IsLocal;
        }
    }
}