using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Models;

namespace CampusLogicEvents.Web.Models
{
    public static class EventPropertyService
    {

        /// <summary>
        /// Get EventProperty data from PM and save to local DB instance
        /// If PM is unavailable, use existing local DB values
        /// </summary>
        public static void UpdateEventPropertyData()
        {
            var updateFromPmSuccessful = EventPropertyManager.Instance.TryUpdatePropertiesAsync().Result;
            UpdateData(updateFromPmSuccessful);
        }

        /// <summary>
        /// Get EventProperty data from PM and save to local DB instance
        /// If PM is unavailable, use existing local DB values
        /// </summary>
        /// <param name="username"></param>
        /// <param name="password"></param>
        /// <param name="environment"></param>
        public static void UpdateEventPropertyData(string username, string password, string environment)
        {
            var updateFromPmSuccessful =
                EventPropertyManager.Instance.TryUpdatePropertiesAsync(username, password, environment).Result;
            UpdateData(updateFromPmSuccessful);
        }

        private static void UpdateData(bool updateFromPmSuccessful)
        {
            using (var dbContext = new CampusLogicContext())
            {
                // if PM data is available, backup to local CL DB
                if (updateFromPmSuccessful)
                {
                    using (DbContextTransaction tran = dbContext.Database.BeginTransaction())
                    {
                        try
                        {
                            dbContext.Database.ExecuteSqlCommand("DELETE FROM [dbo].[EventProperty]");

                            dbContext.EventProperty.AddRange(EventPropertyManager.Instance.EventProperties.Select(p =>
                                new EventProperty
                                {
                                    Id = p.Id,
                                    Name = p.Name,
                                    DisplayName = p.DisplayName,
                                    DisplayFormula = p.DisplayFormula,
                                    CallbackEndpoint = p.CallbackEndpoint,
                                    CallbackFileEndpoint = p.CallbackFileEndpoint
                                }));

                            tran.Commit();
                            dbContext.SaveChanges();
                        }
                        catch (Exception e)
                        {
                            tran.Rollback();
                            LogManager.ErrorLog($"EventPropertyService UpdateData Error: {e}");
                        }
                    }
                }
                // else, use the local CL Connect data
                else
                {
                    List<EventProperty> properties = new List<EventProperty>();
                    foreach(var item in dbContext.EventProperty)
                    {
                        properties.Add(new EventProperty()
                        {
                            Id = item.Id,
                            Name = item.Name,
                            DisplayName = item.DisplayName,
                            DisplayFormula = item.DisplayFormula,
                            CallbackEndpoint = item.CallbackEndpoint,
                            CallbackFileEndpoint = item.CallbackFileEndpoint
                        });
                    }

                    EventPropertyManager.Instance.EventProperties = properties;
                }
            }
        }
    }
}