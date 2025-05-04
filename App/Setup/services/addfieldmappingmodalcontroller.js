'use strict';

//Register this modal as a service
var clConnectServices = angular.module("clConnectServices");
clConnectServices.factory("addfieldmappingmodalcontroller", ["$modal",
    function ($modal) {

        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {

            modalController: ["$rootScope", "$scope", "$modalInstance", "modalParams",
                function ($rootScope, $scope, $modalInstance, modalParams) {
                    $scope.dropdown = { eventPropertyValueAvailableProperties: modalParams.eventPropertyValueAvailableProperties };
                    $scope.selectedValueType = selectedValueType();
                    $scope.onSelectedValueChange = onSelectedValueChange;
                    $scope.theItem = modalParams.theItem;
                    $scope.theList = modalParams.theList;

                    $scope.fieldSizeValidation = false;
                    $scope.dataTypeValidation = false;
                    $scope.fileFieldNameValidation = false;

                    if (modalParams.theItem === undefined || modalParams.theItem === null) {
                        $scope.modelCopy = {
                            fieldPosition: modalParams.fieldPosition,
                            fieldSize: null,
                            dataType: "String",
                            fileFieldName: null,
                            propertyFieldValue: null,
                            constantFieldValue: null,
                            dbCommandFieldValue: null,
                            dynamicFieldValue: null
                        };
                        
                        $scope.modalType = "Add";
                    } else {
                        $scope.modelCopy = angular.copy(modalParams.theItem);
                        $scope.modalType = "Edit";
                    }

                    function selectedValueType() {
                        if (modalParams.theItem === undefined || modalParams.theItem === null) {
                            return "Basic Property Value";
                        }
                        else if (modalParams.theItem.propertyFieldValue) {
                            return "Basic Property Value";
                        }
                        else if (modalParams.theItem.constantFieldValue) {
                            return "Constant Value";
                        }
                        else if (modalParams.theItem.dbCommandFieldValue) {
                            return "Database Command";
                        }
                        else if (modalParams.theItem.dynamicFieldValue) {
                            return "Dynamic Field Value";
                        }
                        return "";
                    }

                    function onSelectedValueChange() {
                        switch ($scope.selectedValueType) {
                            case "Basic Property Value":
                                $scope.modelCopy.constantFieldValue = null;
                                $scope.modelCopy.dbCommandFieldValue = null;
                                $scope.modelCopy.dynamicFieldValue = null;
                                break;
                            case "Constant Value":
                                $scope.modelCopy.propertyFieldValue = null;
                                $scope.modelCopy.dbCommandFieldValue = null;
                                $scope.modelCopy.dynamicFieldValue = null;
                                break;
                            case "Database Command":
                                $scope.modelCopy.constantFieldValue = null;
                                $scope.modelCopy.propertyFieldValue = null;
                                $scope.modelCopy.dynamicFieldValue = null;
                                break;
                            case "Database Command":
                                $scope.modelCopy.constantFieldValue = null;
                                $scope.modelCopy.dbCommandFieldValue = null;
                                $scope.modelCopy.propertyFieldValue = null;
                                break;
                            default:
                                $scope.modelCopy.propertyFieldValue = null;
                                $scope.modelCopy.constantFieldValue = null;
                                $scope.modelCopy.dbCommandFieldValue = null;
                                $scope.modelCopy.dynamicFieldValue = null;
                                break;
                        }
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
                                $scope.theList[$scope.theItem.fieldPosition - 1] = $scope.theItem;
                            }
                            $scope.closeModal();
                        }
                    };

                    $scope.formIsValid = function() {
                        var formIsValid = true;
                        $scope.fieldSizeValidation = false;
                        $scope.dataTypeValidation = false;
                        $scope.fileFieldNameValidation = false;

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.fieldSize)) {
                            formIsValid = false;
                            $scope.fieldSizeValidation = true;
                        }
                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.dataType)) {
                            formIsValid = false;
                            $scope.dataTypeValidation = true;
                        }
                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.fileFieldName)) {
                            formIsValid = false;
                            $scope.fileFieldNameValidation = true;
                        }

                        return formIsValid;
                    };
                }],

            open: function (theItem, fieldPosition, theList, eventPropertyValueAvailableProperties) {
                //Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddFieldMappingModal",
                    controller: service.modalController,
                    resolve: {
                        modalParams: function () {
                            return {
                                theItem: theItem,
                                fieldPosition: fieldPosition,
                                theList: theList,
                                eventPropertyValueAvailableProperties: eventPropertyValueAvailableProperties.sort()
                            };
                        }
                    },
                    backdrop: 'static',
                    windowClass: "show"
                });

                //Done
                return $modalInstance;
            }

        };

        //Done
        return service;

    }]
);
