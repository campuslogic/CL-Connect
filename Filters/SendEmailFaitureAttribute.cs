using CampusLogicEvents.Web.Models;
using Hangfire.Common;
using Hangfire.States;
using Hangfire.Storage;

namespace CampusLogicEvents.Web.Filters
{
    public class SendEmailFailureAttribute : JobFilterAttribute, IApplyStateFilter
    {

        /// <summary>
        /// After the maximum number of retry attempts has
        /// been made send an email indicating the failure
        /// </summary>
        /// <param name="context"></param>
        /// <param name="transaction"></param>
        public void OnStateApplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
        {
            var failedState = context.NewState as FailedState;
            if (failedState != null)
            {
                NotificationService.ErrorNotification($"Background job {context.JobId}", failedState.Exception);
            }
        }

        public void OnStateUnapplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
        {

        }
    }
}