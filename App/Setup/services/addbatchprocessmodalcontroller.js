'use strict';

var clConnectServices = angular.module("clConnectServices");

clConnectServices.factory("addbatchprocessmodalcontroller", ["$modal",
    function ($modal) {
        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {
            modalController: ["$rootScope", "$scope", "$modalInstance", "modalParams",
                function ($rootScope, $scope, $modalInstance, modalParams) {
                    $scope.typeName = modalParams.typeName;
                    $scope.displayName = modalParams.displayName;
                    $scope.theItem = modalParams.theItem;
                    $scope.theList = modalParams.theList;

                    $scope.batchNameValidation = false;
                    $scope.batchNameDuplicateValidation = false;
                    $scope.batchNameLengthValidation = false;
                    $scope.maxBatchSizeValidation = false;
                    $scope.batchExecutionMinutesValidation = false;
                    $scope.batchSizeWithIndexValidation = false;

                    if (modalParams.theItem === undefined || modalParams.theItem === null) {
                        $scope.modelCopy = {
                            batchName: null,
                            maxBatchSize: 0,
                            fileNameFormat: '',
                            batchExecutionMinutes: 0,
                            indexFileEnabled: false,
                            fileDefinitionName: null,
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
                        $scope.batchNameValidation = false;
                        $scope.batchNameDuplicateValidation = false;
                        $scope.batchNameLengthValidation = false;
                        $scope.maxBatchSizeValidation = false;
                        $scope.batchExecutionMinutesValidation = false;
                        $scope.batchFileDefinitionNameValidation = false;

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.batchName)) {
                            formIsValid = false;
                            $scope.batchNameValidation = true;
                        }

                        if ($scope.modelCopy.batchName && $scope.modelCopy.batchName.length > 25) {
                            formIsValid = false;
                            $scope.batchNameLengthValidation = true;
                        }

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.maxBatchSize)) {
                            formIsValid = false;
                            $scope.maxBatchSizeValidation = true;
                        }
                        
                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.batchExecutionMinutes)) {
                            formIsValid = false;
                            $scope.batchExecutionMinutesValidation = true;
                        }

                        var batchNameMatches = $.grep($scope.theList, function (batchProcess) {
                            return batchProcess.batchName === $scope.modelCopy.batchName && batchProcess.index !== $scope.modelCopy.index;
                        });

                        if (batchNameMatches.length > 0) {
                            formIsValid = false;
                            $scope.batchNameDuplicateValidation = true;
                        }

                        if ($scope.modelCopy.indexFileEnabled == true && $rootScope.isNullOrWhitespace($scope.modelCopy.fileDefinitionName)) {
                            formIsValid = false;
                            $scope.batchFileDefinitionNameValidation = true;
                        }

                        if ($scope.modelCopy.indexFileEnabled == true && $scope.modelCopy.maxBatchSize != 1) {
                            formIsValid = false;
                            $scope.batchSizeWithIndexValidation = true;
                        }

                        return formIsValid;
                    };
                }],

            open: function (dataItem, batchProcessingType, displayName) {
                // Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddBatchProcessModal",
                    controller: service.modalController,
                    resolve: {
                        modalParams: function () {
                            return {
                                typeName: batchProcessingType.typeName,
                                displayName: displayName,
                                theItem: dataItem,
                                theList: batchProcessingType.batchProcesses
                            };
                        }
                    },
                    backdrop: 'static',
                    windowClass: "show modal-medium"
                });

                return $modalInstance;
            }
        };

        return service;
    }]
);