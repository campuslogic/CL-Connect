'use strict';

var clConnectServices = angular.module("clConnectServices");

clConnectServices.factory("addapiintegrationmodalcontroller", ["$modal",
    function ($modal) {
        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {
            modalController: ["$rootScope", "$scope", "$modalInstance", "modalParams",
                function ($rootScope, $scope, $modalInstance, modalParams) {
                    $scope.theItem = modalParams.theItem;
                    $scope.theList = modalParams.theList;

                    if (!modalParams.theItem.authentication) {
                        $scope.modelCopy = {
                            apiId: modalParams.theItem.apiId,
                            apiName: null,
                            authentication: null,
                            tokenService: null,
                            root: null,
                            username: null,
                            password: null
                        };

                        $scope.modalType = "Add";
                    } else {
                        $scope.modelCopy = angular.copy(modalParams.theItem);
                        $scope.modalType = "Edit";
                    }

                    // For IE compatibility
                    if (!String.prototype.startsWith) {
                        String.prototype.startsWith = function (searchString, position) {
                            position = position || 0;
                            return this.indexOf(searchString, position) === position;
                        };
                    }

                    $scope.formIsValid = function () {
                        var formIsValid = true;
                        $scope.apiNameIsValid = true;
                        $scope.apiNameIsDuplicate = false;
                        $scope.tokenIsValid = true;
                        $scope.rootIsValid = true;
                        $scope.usernameIsValid = true;
                        $scope.passwordIsValid = true;


                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.apiName)) {
                            formIsValid = false;
                            $scope.apiNameIsValid = false;
                        }

                        var apiNameMatches = $.grep($scope.theList, function (apiIntegration) {
                            return apiIntegration.apiName === $scope.modelCopy.apiName && apiIntegration.apiId !== $scope.modelCopy.apiId;
                        });

                        if (apiNameMatches.length > 0) {
                            formIsValid = false;
                            $scope.apiNameIsDuplicate = true;
                        }

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.root)) {
                            formIsValid = false;
                            $scope.rootIsValid = false;
                        } else {
                            // Ensure root is valid URL
                            if (!$scope.modelCopy.root.startsWith("http://") && !$scope.modelCopy.root.startsWith("https://")) {
                                formIsValid = false;
                                $scope.rootIsValid = false;
                            }
                        }

                        if ($scope.modelCopy.authentication !== 'none') {
                            if ($scope.modelCopy.authentication === 'oauth2' || $scope.modelCopy.authentication === 'oauth_wrap') {
                                if ($rootScope.isNullOrWhitespace($scope.modelCopy.tokenService)) {
                                    formIsValid = false;
                                    $scope.tokenIsValid = false;
                                } else {
                                    // Ensure token is valid URL
                                    if (!$scope.modelCopy.tokenService.startsWith("http://") && !$scope.modelCopy.tokenService.startsWith("https://")) {
                                        formIsValid = false;
                                        $scope.tokenIsValid = false;
                                    }
                                }
                            }

                            if ($rootScope.isNullOrWhitespace($scope.modelCopy.username)) {
                                formIsValid = false;
                                $scope.usernameIsValid = false;
                            }

                            if ($rootScope.isNullOrWhitespace($scope.modelCopy.password)) {
                                formIsValid = false;
                                $scope.passwordIsValid = false;
                            }
                        }
                        
                        return formIsValid;
                    }

                    $scope.closeModal = function () {
                        $modalInstance.close();
                    };

                    $scope.save = function () {
                        if ($scope.formIsValid()) {
                            $scope.theItem = angular.copy($scope.modelCopy);

                            for (var i = 0; i < $scope.theList.length; i++) {
                                if ($scope.theList[i].apiId === $scope.modelCopy.apiId) {
                                    $scope.theList[i] = $scope.theItem;
                                    break;
                                }
                            }

                            $scope.closeModal();
                        }
                    };
                }],

            open: function (apiIntegration, apiIntegrationsList) {
                // Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddApiIntegrationModal",
                    controller: service.modalController,
                    resolve: {
                        modalParams: function () {
                            return {
                                theItem: apiIntegration,
                                theList: apiIntegrationsList
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