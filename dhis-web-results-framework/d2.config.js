/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: "app",
    appName: "dhis-web-results-framework",
    appTitle: "NDP Results Framework V2",
    name: "NDP Results Framework V2",
    customAuthorities: ["NDP_DATA_ENTRY_LOCKER"],
    entryPoints: {
        app: "./src/App.tsx",
    },
};

module.exports = config
