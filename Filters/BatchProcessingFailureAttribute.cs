using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Models;
using CampusLogicEvents.Web.Models;
using Hangfire.Common;
using Hangfire.States;
using Hangfire.Storage;


namespace CampusLogicEvents.Web.Filters
{
    public class BatchProcessingFailureAttribute : JobFilterAttribute, IApplyStateFilter
    {
        /// <summary>
        /// After batch processing has failed
        /// ensure to reset all the processing IDs
        /// </summary>
        /// <param name="context"></param>
        /// <param name="transaction"></param>
        public void OnStateApplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
        {
            var failedState = context.NewState as FailedState;
            if (failedState != null)
            {
                LogManager.InfoLog($"Batch processing failed, updating all processing IDs to null");
                using (var dbContext = new CampusLogicContext())
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[BatchProcessRecord] SET [ProcessGuid] = NULL");
            }
        }

        public void OnStateUnapplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
        {

        }
    }
}