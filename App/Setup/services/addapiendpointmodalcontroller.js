'use strict';

var clConnectServices = angular.module("clConnectServices");

clConnectServices.factory("addapiendpointmodalcontroller", ["$modal",
    function ($modal) {
        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {
            modalController: ["$rootScope", "$scope", "$modalInstance", "modalParams",
                function ($rootScope, $scope, $modalInstance, modalParams) {
                    $scope.theItem = modalParams.theItem;
                    $scope.apiId = modalParams.apiId;
                    $scope.endpointsList = modalParams.endpointsList;
                    $scope.endpointReadonly = modalParams.endpointReadonly;
                    $scope.originalEndpointName = null;
                    $scope.dropdown =
                    {
                        dataSource: modalParams.eventPropertyValues,
                        optionLabel: "Select property..."
                    };
                    $scope.parameterMappings = [
                        {
                            parameter: "",
                            eventData: null
                        }
                    ];

                    $scope.methods = [
                        { text: "GET", value: "GET" },
                        { text: "POST", value: "POST" },
                        { text: "PUT", value: "PUT" }
                    ];

                    $scope.populateParameterMappings = function () {
                        if ($scope.modelCopy.parameterMappings !== null) {
                            $scope.parameterMappings = [];

                            var mappings = JSON.parse($scope.modelCopy.parameterMappings);
                            for (var i = 0; i < mappings.length; i++) {
                                var mapping = mappings[i];
                                $scope.parameterMappings.push({ parameter: mapping.parameter, eventData: mapping.eventData });
                            }

                            $scope.parameterMappings.push({ parameter: "", eventData: null });
                            $scope.$apply;
                        }
                    };

                    if (modalParams.theItem === undefined || modalParams.theItem === null) {
                        $scope.modelCopy = {
                            apiId: modalParams.apiId,
                            name: null,
                            endpoint: null,
                            method: 'GET',
                            mimeType: null,
                            parameterMappings: null
                        };

                        $scope.modalType = "Add";
                    } else {
                        $scope.modelCopy = angular.copy(modalParams.theItem);
                        $scope.originalEndpointName = modalParams.theItem.name;
                        $scope.populateParameterMappings();
                        $scope.modalType = "Edit";
                    }

                    $scope.getIndex = function () {
                        if ($scope.originalEndpointName) {
                            for (var i = 0; i < $scope.endpointsList.length; i++) {
                                if ($scope.endpointsList[i].name === $scope.originalEndpointName) {
                                    return i;
                                }
                            }
                        } else {
                            return $scope.endpointsList.length;
                        }
                    };

                    $scope.formIsValid = function () {
                        var formIsValid = true;
                        $scope.endpointNameIsValid = true;
                        $scope.endpointNameIsDuplicate = false;
                        $scope.mimeTypeIsValid = true;
                        $scope.hasParameters = false;

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.name)) {
                            formIsValid = false;
                            $scope.endpointNameIsValid = false;
                        }

                        var index = $scope.getIndex();

                        for (var i = 0; i < $scope.endpointsList.length; i++) {
                            if (i !== index && $scope.endpointsList[i].name === $scope.modelCopy.name) {
                                formIsValid = false;
                                $scope.endpointNameIsDuplicate = true;
                            }
                        }

                        if ($scope.modelCopy.method == "POST" || $scope.modelCopy.method == "PUT") {
                            if ($rootScope.isNullOrWhitespace($scope.modelCopy.mimeType)) {
                                formIsValid = false;
                                $scope.mimeTypeIsValid = false;
                            }
                        } else {
                            $scope.modelCopy.mimeType = "";
                        }

                        for (var i = 0; i < $scope.parameterMappings.length; i++) {
                            if ($scope.parameterMappings[i].parameter) {
                                $scope.hasParameters = true;
                                break;
                            } else {
                                formIsValid = false;
                            }
                        }

                        return formIsValid;
                    };

                    $scope.closeModal = function () {
                        $modalInstance.close();
                    };

                    $scope.cleanupParameterMappings = function () {
                        var i = $scope.parameterMappings.length;
                        while (i--) {
                            delete $scope.parameterMappings[i]['$$hashKey'];
                            if ($rootScope.isNullOrWhitespace($scope.parameterMappings[i].parameter)) {
                                $scope.parameterMappings.splice(i, 1);
                            }
                        }

                        $scope.modelCopy.parameterMappings = JSON.stringify($scope.parameterMappings);
                    };

                    $scope.save = function () {
                        if ($scope.formIsValid()) {
                            $scope.cleanupParameterMappings();
                            $scope.theItem = angular.copy($scope.modelCopy);
                            if ($scope.modalType === "Add") {
                                $scope.endpointsList.push($scope.theItem);
                            } else {
                                $scope.endpointsList[$scope.getIndex()] = $scope.theItem;
                            }
                            $scope.closeModal();
                        }
                    };

                    $scope.newParameterMapping = function () {
                        if ($scope.parameterMappings[$scope.parameterMappings.length - 1].parameter !== "") {
                            $scope.parameterMappings.push({ parameter: "", eventData: null });
                            $scope.$apply;
                        }
                    };

                    $scope.deleteParameterMapping = function (index) {
                        $scope.parameterMappings.splice(index, 1);
                        $scope.$apply;
                    };
                }],

            open: function (dataItem, apiId, endpointsList, eventPropertyValues, endpointReadonly) {
                // Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddApiEndpointModal",
                    controller: service.modalController,
                    resolve: {
                        modalParams: function () {
                            return {
                                theItem: dataItem,
                                apiId: apiId,
                                endpointsList: endpointsList,
                                eventPropertyValues: eventPropertyValues,
                                endpointReadonly: endpointReadonly
                            };
                        }
                    },
                    backdrop: 'static',
                    windowClass: "show"
                });

                return $modalInstance;
            }
        };

        return service;
    }]
);