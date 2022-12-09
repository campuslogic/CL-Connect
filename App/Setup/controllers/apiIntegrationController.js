(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('apiIntegrationController', apiIntegrationController);

    apiIntegrationController.$inject = ['$scope', '$compile', 'setupservice', 'addapiintegrationmodalcontroller', 'addapiendpointmodalcontroller', 'validationservice'];


    function apiIntegrationController($scope, $compile, setupservice, addapiintegrationmodalcontroller, addapiendpointmodalcontroller, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.addapiendpointmodalcontroller = addapiendpointmodalcontroller;
        vm.addapiintegrationmodalcontroller = addapiintegrationmodalcontroller;
        vm.pageValid = validationservice.pageValidations.apiIntegrationsValid;
        onLoad();
        
        vm.gridOptions = [];

        vm.gridOptions['none'] = {
            columns:
            [{ 'field': 'apiName', title: 'API Name' },
             { 'field': 'authentication', title: 'Authentication' },
             { 'field': 'root', title: 'Root' },
             {
                 command: [
                 {
                     template: kendo.template($("#add-api-settings-template").html())
                 }
                 ],
                 width: "120px"
             }]
        };

        vm.gridOptions['basic'] = {
            columns:
            [{ 'field': 'apiName', title: 'API Name' },
             { 'field': 'authentication', title: 'Authentication' },
             { 'field': 'root', title: 'Root' },
             { 'field': 'username', title: 'Username' },
             {
                 'field': 'password', title: 'Password', template: function (dataItem) {
                     return '●'.repeat(dataItem.password.length);
                 }
             },
             {
                 command: [
                 {
                     template: kendo.template($("#add-api-settings-template").html())
                 }
                 ],
                 width: "120px"
             }]
        };

        vm.gridOptions['oauth2'] = {
            columns:
            [{ 'field': 'apiName', title: 'API Name' },
             { 'field': 'authentication', title: 'Authentication' },
             { 'field': 'tokenService', title: 'Token Service' },
             { 'field': 'root', title: 'Root' },
             { 'field': 'username', title: 'Client ID' },
             {
                 'field': 'password', title: 'Client Secret', template: function (dataItem) {
                     return '●'.repeat(dataItem.password.length);
                 }
             },
             {
                command: [
                {
                    template: kendo.template($("#add-api-settings-template").html())
                }
                ],
                width: "120px"
             }]
        };

        vm.gridOptions['oauth_wrap'] = {
            columns:
            [{ 'field': 'apiName', title: 'API Name' },
             { 'field': 'authentication', title: 'Authentication' },
             { 'field': 'tokenService', title: 'Token Service' },
             { 'field': 'root', title: 'Root' },
             { 'field': 'username', title: 'Username' },
             {
                 'field': 'password', title: 'Password', template: function (dataItem) {
                     var str = '';
                     for (var i = 0; i < dataItem.password.length; i++) {
                         str += '●';
                     }
                     return str;
                 }
             },
             {
                 command: [
                 {
                     template: kendo.template($("#add-api-settings-template").html())
                 }
                 ],
                 width: "120px"
             }]
        };

        vm.gridOptions['ethos'] = {
            columns:
            [{ 'field': 'apiName', title: 'API Name' },
            { 'field': 'authentication', title: 'Authentication' },
            { 'field': 'root', title: 'Root' },
            {
                    'field': 'password', title: 'API Key', template: function (dataItem) {
                        var str = '';
                        for (var i = 0; i < dataItem.password.length; i++) {
                            str += '●';
                        }
                        return str;
                    }
            },
            {
                command: [
                    {
                        template: kendo.template($("#add-api-settings-template").html())
                    }
                ],
                width: "120px"
            }]
        };

        vm.gridOptions['endpoints'] = {
            columns:
            [{ 'field': 'name', title: 'Name' },
             { 'field': 'endpoint', title: 'Endpoint' },
             { 'field': 'method', title: 'Method' },
             { 'field': 'mimeType', title: 'MIME Type' },
             {
                 'field': 'parameterMappings', title: 'Parameter Mappings', template: function (dataItem) {
                     var parameterMappings = JSON.parse(dataItem.parameterMappings);
                     var html = [];

                     for (var i = 0; i < parameterMappings.length; i++) {
                         html.push('<span>' + parameterMappings[i].parameter + '</span> <i class="fa fa-long-arrow-right"></i> ');
                         html.push('<span>' + parameterMappings[i].eventData + '</span><br/>');
                     }

                     return html.join('');
                 }
             },
             {
                 command: [
                 {
                     template: kendo.template($("#add-endpoint-template").html())
                 }
                 ],
                 width: "120px"
             }]
        };

        function setEndpointsForApi(apiId) {
            vm.endpoints[apiId] = [];

            for (var i = 0; i < vm.apiEndpointsList.length; i++) {
                if (vm.apiEndpointsList[i].apiId === apiId) {
                    vm.endpoints[apiId].push(vm.apiEndpointsList[i]);
                }
            }
        }

        function onLoad() {
            // A list of list of endpoints per API.
            vm.endpoints = [];

            // The list of all endpoints
            vm.apiEndpointsList = vm.service.configurationModel.campusLogicSection.apiEndpointsList;

            vm.apiIntegrationsList = vm.service.configurationModel.campusLogicSection.apiIntegrationsList;
            for (var i = 0; i < vm.apiIntegrationsList.length; i++) {
                setEndpointsForApi(vm.apiIntegrationsList[i].apiId);
            }
        }

        vm.refreshEndpoints = function (apiId) {
            setEndpointsForApi(apiId);
            $('#api_endpoints_grid_' + apiId).data('kendoGrid').dataSource.read();
        };

        vm.getIndexOfApiIntegration = function (apiId) {
            for (var i = 0; i < vm.apiIntegrationsList.length; i++) {
                if (vm.apiIntegrationsList[i].apiId === apiId) {
                    return i;
                }
            }

            return -1;
        };

        vm.deleteEndpoint = function (dataItem, apiId) {
            // Find where the endpoint is in the endpoints list
            for (var i = 0; i < vm.apiEndpointsList.length; i++) {
                if (vm.apiEndpointsList[i].endpoint === dataItem.endpoint) {
                    vm.apiEndpointsList.splice(i, 1);
                    break;
                }
            }
            vm.refreshEndpoints(apiId);
        };

        vm.addOrEditEndpoint = function (dataItem, apiId) {
            var eventPropertyValues = setupservice.configurationModel.campusLogicSection.eventPropertyValueAvailableProperties;
            vm.addapiendpointmodalcontroller.open(dataItem, apiId, vm.apiEndpointsList, eventPropertyValues).result.then(function () {
                vm.refreshEndpoints(apiId);
            });
        };
        
        vm.refreshApiIntegrations = function (apiId) {
            $('#api_grid_' + apiId).data('kendoGrid').dataSource.read();
        };

        vm.deleteApiIntegration = function (apiIntegration) {
            var index = vm.getIndexOfApiIntegration(apiIntegration.apiId);
            vm.apiIntegrationsList.splice(index, 1);

            // Remove all corresponding endpoints
            var i = vm.apiEndpointsList.length;
            while (i--){
                if (vm.apiEndpointsList[i].apiId == apiIntegration.apiId) {
                    vm.apiEndpointsList.splice(i, 1);
                }
            }

            vm.refreshApiIntegrations(apiIntegration.apiId);
            vm.refreshEndpoints(apiIntegration.apiId);
        };

        vm.editApiIntegration = function (apiIntegration) {
            vm.addapiintegrationmodalcontroller.open(apiIntegration, vm.apiIntegrationsList).result.then(function () {
                // API Integration setup has been completed, update the grid
                vm.refreshApiIntegrations(apiIntegration.apiId);
            });
        };

        vm.getNewId = function () {
            if (vm.apiIntegrationsList.length > 0) {
                var lastId = parseInt(vm.apiIntegrationsList[vm.apiIntegrationsList.length - 1].apiId);
                return (lastId + 1).toString();
            } else {
                return "0";
            }
        }

        vm.addApiIntegration = function () {
            var apiIntegration = {
                apiId: vm.getNewId(),
                apiName: null,
                authentication: null,
                tokenService: null,
                root: null,
                username: null,
                password: null
            }
            vm.apiIntegrationsList.push(apiIntegration);
            vm.addapiintegrationmodalcontroller.open(apiIntegration, vm.apiIntegrationsList).result.then(function () {
                // API Integration setup has been completed, update the grid
                vm.refreshApiIntegrations(apiIntegration.apiId);
            }, function () {
                // API Integration setup has been canceled, remove from grid
                vm.apiIntegrationsList.splice(vm.apiIntegrationsList.length - 1, 1);
            });
        };
    }
})();