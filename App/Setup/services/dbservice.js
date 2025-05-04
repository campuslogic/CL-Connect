(function () {
    'use strict';

    angular
        .module('clConnectServices')
        .factory('dbservice', dbservice);

    dbservice.$inject = ['$resource'];

    function dbservice($resource) {
        var service = {
            dbSize: $resource('api/Database/GetInfo')
        };

        return service;
    }
})();