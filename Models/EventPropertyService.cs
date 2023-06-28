using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;

namespace CampusLogicEvents.Web.Models
{
    public static class EventPropertyService
    {

        /// <summary>
        /// Get EventProperty data from Gateway and save to local DB instance
        /// If gateway is unavailable, use existing local DB values
        /// </summary>
        public static void UpdateEventPropertyData()
        {
            var gatewayInfo = EventPropertyManager.Instance.TryUpdatePropertiesAsync().Result;
            UpdateData(gatewayInfo);
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
            var gatewayInfoDto =
                EventPropertyManager.Instance.TryUpdatePropertiesAsync(username, password, environment).Result;
            UpdateData(gatewayInfoDto);
        }

        private static void UpdateData(GatewayInfoDto gatewayInfo)
        {
            using (var dbContext = new CampusLogicContext())
            {
                // if PM data is available, backup to local CL DB
                if (gatewayInfo != null)
                {
                    using (DbContextTransaction tran = dbContext.Database.BeginTransaction())
                    {
                        try
                        {
                            dbContext.Database.ExecuteSqlCommand("DELETE FROM [dbo].[EventNotificationEventProperty]");
                            dbContext.Database.ExecuteSqlCommand("DELETE FROM [dbo].[EventProperty]");
                            dbContext.Database.ExecuteSqlCommand("DELETE FROM [dbo].[EventNotificationDefinition]");

                            dbContext.EventNotificationDefinition.AddRange(gatewayInfo.EventNotifications);

                            dbContext.EventProperty.AddRange(gatewayInfo.EventProperties.Select(p =>
                                new EventProperty
                                {
                                    Id = p.Id,
                                    Name = p.Name,
                                    DisplayName = p.DisplayName,
                                    DisplayFormula = p.DisplayFormula,
                                }));

                            dbContext.SaveChanges();

                            foreach (var p in gatewayInfo.EventProperties)
                            {
                                var existingProperty = dbContext.EventProperty.Single(e => e.Id == p.Id);
                                var existingEventNotifications = dbContext.EventNotificationDefinition.Where(x => p.EventNotificationIds.Contains(x.Id)).ToList();
                                foreach (var eventNotification in existingEventNotifications)
                                {
                                    existingProperty.EventNotificationDefinition.Add(eventNotification);
                                }
                            }

                            dbContext.SaveChanges();
                            tran.Commit();
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
                    List<EventPropertyDto> properties = new List<EventPropertyDto>();
                    foreach (var item in dbContext.EventProperty)
                    {
                        properties.Add(new EventPropertyDto()
                        {
                            Id = item.Id,
                            Name = item.Name,
                            DisplayName = item.DisplayName,
                            DisplayFormula = item.DisplayFormula
                        });
                    }

                    EventPropertyManager.Instance.EventProperties = properties;
                }
            }
        }

        public static EventNotificationDefinition GetCallbackUrls(int eventNotificationId)
        {
            using (var dbContext = new CampusLogicContext())
            {
                return dbContext.EventNotificationDefinition.SingleOrDefault(x => x.Id == eventNotificationId);
            }
        }

        public static List<EventNotificationDefinitionDto> GetEventNotificationDefinitions()
        {
            using (var dbContext = new CampusLogicContext())
            {
                return dbContext.EventNotificationDefinition.Select( x => new EventNotificationDefinitionDto { EventNotificationId = x.Id, EventNotificationName = x.EventName }).ToList();
            }
        }
    }
}