'use strict';

var clConnectServices = angular.module("clConnectServices");

clConnectServices.factory("addpowerfaidsmodalcontroller", ["$modal",
    function ($modal) {
        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {
            modalController: ["$rootScope", "$scope", "$modalInstance", "modalParams",
                function ($rootScope, $scope, $modalInstance, modalParams) {
                    $scope.theItem = modalParams.theItem;
                    $scope.theList = modalParams.theList;

                    $scope.submitted = false;
                    
                    if (modalParams.theItem === undefined || modalParams.theItem === null) {
                        $scope.modelCopy = {
                            event: null,
                            transactionCategory: null,
                            outcome: null,
                            requiredFor: null,
                            status: null,
                            documentLock: null,
                            verificationOutcome: null,
                            verificationOutcomeLock: null,
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
                        $scope.theItem = angular.copy($scope.modelCopy);
                        if ($scope.modalType === "Add") {
                            $scope.theList.push($scope.theItem);
                        } else {
                            $scope.theList[$scope.theItem.index] = $scope.theItem;
                        }
                        $scope.closeModal();
                    };
                }],

            open: function (powerFaidsRecord, powerFaidsList) {
                // Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddPowerFaidsModal",
                    controller: service.modalController,
                    resolve: {
                        modalParams: function () {
                            return {
                                theItem: powerFaidsRecord,
                                theList: powerFaidsList
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