(function () {
    'use strict';

    angular
        .module('clConnectControllers')
        .controller('eventnotificationscontroller', eventnotificationscontroller);

    eventnotificationscontroller.$inject = ['resolveEventNotificationTypes', 'resolveEventNotifications', 'setupservice', 'validationservice'];

    function eventnotificationscontroller(resolveEventNotificationTypes, resolveEventNotifications, setupservice, validationservice) {
        var vm = this;

        vm.addEventNotification = addEventNotification;
        vm.clientDatabaseConnection = setupservice.configurationModel.campusLogicSection.clientDatabaseConnection;
        vm.connectionStringType = 'n'; // valid values 'c' = connection string, 'd' = dsn, 'n' = none
        vm.dsnName = '';
        vm.dsnPassword = '';
        vm.dsnUser = '';
        vm.usingDatabase = (vm.clientDatabaseConnection.connectionString !== '');
        vm.eventNotifications = setupservice.configurationModel.campusLogicSection.eventNotifications;
        vm.eventNotificationTypes = resolveEventNotificationTypes;
        vm.eventNotificationDefinitions = resolveEventNotifications;
        vm.IsCommandEnabled = IsCommandEnabled;
        vm.IsFileStoreEnabled = IsFileStoreEnabled;
        vm.IsBatchProcessingEnabled = IsBatchProcessingEnabled;
        vm.IsApiIntegrationsEnabled = IsApiIntegrationsEnabled;
        vm.onConnectionStringTypeChange = onConnectionStringTypeChange;
        vm.removeEventNotification = removeEventNotification;
        vm.testConnectionString = testConnectionString;
        vm.onTextBoxChange = onTextBoxChange;
        vm.validationService = validationservice;
        vm.eventNotificationsValid = validationservice.pageValidations.eventNotificationsValid;
        vm.duplicateEvent = false;
        vm.invalidBatchName = false;
        vm.invalidApiEndpointName = false;
        vm.checkForDuplicateEvent = checkForDuplicateEvent;
        vm.checkForInvalidBatchName = checkForInvalidBatchName;
        vm.hasInvalidApiEndpointName = hasInvalidApiEndpointName;
        vm.handleMethodChange = handleMethodChange;

        onLoad();

        function checkForInvalidBatchName() {
            vm.invalidBatchName = validationservice.checkForInvalidBatchName();
        }

        function hasInvalidApiEndpointName() {
            vm.invalidApiEndpointName = validationservice.hasInvalidApiEndpointName();
        }

        function checkForDuplicateEvent() {
            vm.duplicateEvent = validationservice.checkForDuplicateEvent();
        }

        function onTextBoxChange() {
            vm.clientDatabaseConnection.connectionString = "DSN=" + vm.dsnName + ";UID=" + vm.dsnUser + ";PWD=" + vm.dsnPassword;
        }

        function addEventNotification() {
            vm.eventNotifications.push({
                eventNotificationId: 0,
                handleMethod: vm.eventNotificationTypes[0].eventNotificationTypeId,
                dbCommandFieldValue: ''
            });
            checkForDuplicateEvent();
            checkForInvalidBatchName();
            hasInvalidApiEndpointName();
        }

        function IsCommandEnabled(index) {
            var eventNotificationTypeId = vm.eventNotifications[index].handleMethod;
            if (!eventNotificationTypeId)
                return false;

            var eventNotificationType = $.grep(vm.eventNotificationTypes, function (e) { return e.eventNotificationTypeId == eventNotificationTypeId; })[0];
            return eventNotificationType.isCommandAttributeRequired;
        }

        function IsFileStoreEnabled(index) {
            var eventNotificationTypeId = vm.eventNotifications[index].handleMethod;
            if (!eventNotificationTypeId)
                return false;

            var eventNotificationType = $.grep(vm.eventNotificationTypes, function (e) { return e.eventNotificationTypeId == eventNotificationTypeId; })[0];
            return eventNotificationType.isFileStoreTypeRequired;
        }

        function IsBatchProcessingEnabled(index) {
            var eventNotificationTypeId = vm.eventNotifications[index].handleMethod;
            if (!eventNotificationTypeId)
                return false;

            var eventNotificationType = $.grep(vm.eventNotificationTypes, function (e) { return e.eventNotificationTypeId == eventNotificationTypeId; })[0];
            return eventNotificationType.isBatchProcessingRequired;
        }

        function IsApiIntegrationsEnabled(index) {
            var eventNotificationTypeId = vm.eventNotifications[index].handleMethod;
            if (!eventNotificationTypeId)
                return false;

            var eventNotificationType = $.grep(vm.eventNotificationTypes, function (e) { return e.eventNotificationTypeId == eventNotificationTypeId; })[0];

            return eventNotificationType.isApiIntegrationRequired;
        }

        function handleMethodChange(e) {
            if (e.handleMethod === 'DocumentRetrieval' || e.handleMethod === 'FileStore' || e.handleMethod === 'FileStoreAndDocumentRetrieval' || e.handleMethod === 'Print' || e.handleMethod === 'BatchProcessingAwardLetterPrint' || e.handleMethod === 'ApiIntegration' || e.handleMethod === 'PowerFAIDS' ) {
                e.dbCommandFieldValue = '';
            }
            if (e.handleMethod !== 'FileStore' && e.handleMethod !== 'FileStoreAndDocumentRetrieval') {
                e.fileStoreType = '';
            }
            if (e.handleMethod === 'FileStore' || e.handleMethod === 'FileStoreAndDocumentRetrieval') {
                e.fileStoreType = 'Shared';
            }
            if (e.handleMethod !== 'BatchProcessingAwardLetterPrint') {
                e.batchName = '';
                vm.invalidBatchName = false;
            }
            if (e.handleMethod !== 'ApiIntegration') {
                e.apiEndpointName = '';
                vm.invalidApiEndpointName = false;
            }
        }

        function onConnectionStringTypeChange() {
            switch (vm.connectionStringType) {
                case 'c':
                    vm.usingDatabase = true;
                    if (vm.clientDatabaseConnection.connectionString.indexOf("DSN") >= 0) {
                        vm.clientDatabaseConnection.connectionString = '';
                    }
                    break;
                case 'n':
                    vm.clientDatabaseConnection.connectionString = '';
                    if (vm.eventNotifications.some(function (eventNotification)
                    {
                        return (eventNotification.handleMethod !== 'DocumentRetrieval'
                               && eventNotification.handleMethod !== 'FileStore'
                               && eventNotification.handleMethod !== 'FileStoreAndDocumentRetrieval'
                               && eventNotification.handleMethod !== 'AwardLetterPrint'
                               && eventNotification.handleMethod !== 'BatchProcessingAwardLetterPrint'
                               && eventNotification.handleMethod !== 'ApiIntegration'
                               && eventNotification.handleMethod !== 'PowerFAIDS'
                        );
                    }))
                    {
                        vm.usingDatabase = true;
                        validationservice.pageValidations.connectionStringValid = false;
                    }
                    else
                    {
                        vm.usingDatabase = false;
                    }
                    break;
                case 'd':
                    vm.usingDatabase = true;
                    vm.clientDatabaseConnection.connectionString = "DSN=" + vm.dsnName + ";UID=" + vm.dsnUser + ";PWD=" + vm.dsnPassword;
                    break;

                default:
                    break;
            }
        }

        function onLoad() {

            vm.customOptions = {
                dataSource: vm.eventNotificationTypes,
                dataTextField: "label",
                dataValueField: "eventNotificationTypeId",
            }
            vm.eventNotificationOptions = {
                template: $("#eventDropdownTemplate").html(),
                valueTemplate: $("#eventDropdownTemplate").html(),
                dataTextField: "eventNotificationId",
                dataValueField: "eventNotificationId",
                dataSource: vm.eventNotificationDefinitions,
                optionLabel: {
                    eventNotificationId: "All",
                    eventNotificationName: 0
                },
            };
            checkForDuplicateEvent();
            checkForInvalidBatchName();
            hasInvalidApiEndpointName();
            if (vm.clientDatabaseConnection.connectionString.indexOf("DSN") >= 0) {
                vm.connectionStringType = 'd';
                var keyValuePairs = vm.clientDatabaseConnection.connectionString.split(';');
                for (var i = 0; i < keyValuePairs.length; i++) {
                    var keyValuePair = keyValuePairs[i].split('=');
                    switch (keyValuePair[0].toUpperCase()) {
                        case 'DSN':
                            vm.dsnName = keyValuePair[1];
                            break;
                        case 'PWD':
                            vm.dsnPassword = keyValuePair[1];
                            break;
                        case 'UID':
                            vm.dsnUser = keyValuePair[1];
                            break;
                        default:
                            break;
                    }
                }
            }
            else if (vm.clientDatabaseConnection.connectionString !== '') {
                vm.connectionStringType = 'c';
            }
            else if (vm.clientDatabaseConnection.connectionString === '') {
                vm.connectionStringType = 'n';
            }
            vm.onConnectionStringTypeChange();
        }

        function removeEventNotification(index) {
            vm.eventNotifications.splice(index, 1);
            checkForDuplicateEvent();
            checkForInvalidBatchName();
            hasInvalidApiEndpointName();
        }

        function testConnectionString(form) {
            if (vm.connectionStringType == 'd')
                vm.clientDatabaseConnection.connectionString = "DSN=" + vm.dsnName + ";UID=" + vm.dsnUser + ";PWD=" + vm.dsnPassword;
            validationservice.testEventNotifications(form);
        };

    };
})();