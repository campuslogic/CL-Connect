'use strict';

//Register this modal as a service
var clConnectServices = angular.module("clConnectServices");
clConnectServices.factory("addparametermodalcontroller", ["$modal",
    function ($modal) {

        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {

            modalController: ["$rootScope", "$scope", "$modalInstance", "modalParams",
                function ($rootScope, $scope, $modalInstance, modalParams) {
                    $scope.dropdown = { eventPropertyValues: modalParams.eventPropertyValues };
                    $scope.theItem = modalParams.theItem;
                    $scope.theList = modalParams.theList;

                    $scope.sourceValidation = false;
                    $scope.dataTypeValidation = false;
                    $scope.nameValidation = false;
                    $scope.nameDuplicateValidation = false;
                    $scope.lengthValidation = false;

                    if (modalParams.theItem === undefined || modalParams.theItem === null) {
                        $scope.modelCopy = {
                            source: null,
                            dataType: "int",
                            name: null,
                            length: null,
                            index: $scope.theList.length
                        };

                        $scope.modalType = "Add";
                    } else {
                        $scope.modelCopy = angular.copy(modalParams.theItem);
                        $scope.modalType = "Edit";
                    }

                    $scope.closeModal = function () {
                        $modalInstance.close();
                    };

                    $scope.save = function () {
                        if ($scope.formIsValid()) {
                            $scope.theItem = angular.copy($scope.modelCopy);
                            if ($scope.modalType === "Add") {
                                $scope.theList.push($scope.theItem);
                            } else {
                                $scope.theList[$scope.theItem.index] = $scope.theItem;
                            }
                            $scope.closeModal();
                        }
                    };

                    $scope.formIsValid = function () {
                        var formIsValid = true;
                        $scope.sourceValidation = false;
                        $scope.dataTypeValidation = false;
                        $scope.nameValidation = false;
                        $scope.nameDuplicateValidation = false;
                        $scope.lengthValidation = false;

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.name)) {
                            formIsValid = false;
                            $scope.nameValidation = true;
                        }
                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.dataType)) {
                            formIsValid = false;
                            $scope.dataTypeValidation = true;
                        }
                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.source)) {
                            formIsValid = false;
                            $scope.sourceValidation = true;
                        }

                        if ($scope.modelCopy.dataType !== 'int') {
                            if ($rootScope.isNullOrWhitespace($scope.modelCopy.length)) {
                                formIsValid = false;
                                $scope.lengthValidation = true;
                            }
                        }

                        var matches = $.grep($scope.theList, function (parameter) {
                            return (parameter.name === $scope.modelCopy.name && parameter.index !== $scope.modelCopy.index);
                        });

                        if (matches.length > 0) {
                            formIsValid = false;
                            $scope.nameDuplicateValidation = true;
                        }

                        return formIsValid;
                    };
                }],

            open: function (dataItem, storedProcedure, eventPropertyValues) {

                //Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddParameterModal",
                    controller: service.modalController,
                    resolve: {
                        modalParams: function () {
                            return {
                                theItem: dataItem,
                                theList: storedProcedure.parameterList,
                                eventPropertyValues: eventPropertyValues
                            };
                        }
                    },
                    backdrop: 'static',
                    windowClass: 'show'
                });

                //Done
                return $modalInstance;
            }

        };

        //Done
        return service;

    }]
);
