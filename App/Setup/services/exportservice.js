(function () {
    'use strict';

    angular
        .module('clConnectServices')
        .factory('exportservice', exportservice);

    exportservice.$inject = ['$resource'];

    function exportservice($resource) {
        var service = {
            exportLogs: $resource('api/Export/ExportLogs')
        };

        return service;
    }
})();