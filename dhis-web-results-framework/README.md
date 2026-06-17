This project was bootstrapped with [DHIS2 Application Platform](https://github.com/dhis2/app-platform).

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in development mode against the training DHIS2 instance.<br />
Open [http://localhost:3000](http://localhost:3000) to view and test local UI changes in the browser.

The development server uses two local ports:

- `http://localhost:3000` serves the app shell and local source changes.
- `http://localhost:8080` is the local DHIS2 proxy used by the app adapter for API calls.

By default, the proxy points to `https://train.ndpme.go.ug/ndpdb`. Production is only used when running `yarn start:prod`.

For direct Policy Actions testing, use:

`http://localhost:3000/api/apps/NDP-Results-Framework-V2/index.html#/ndp/policy-actions`

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `yarn start:train`

Runs the same local development setup as `yarn start`, explicitly binding the app to port `3000` and the training proxy to port `8080`.

### `yarn start:prod`

Runs the local development setup against the production DHIS2 instance. Use this only when intentionally testing against production.

### `yarn test`

Launches the test runner and runs all available tests found in `/src`.<br />

See the section about [running tests](https://platform.dhis2.nu/#/scripts/test) for more information.

### `yarn build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
A deployable `.zip` file can be found in `build/bundle`!

See the section about [building](https://platform.dhis2.nu/#/scripts/build) for more information.

### `yarn deploy`

Deploys the built app in the `build` folder to a running DHIS2 instance.<br />
This command will prompt you to enter a server URL as well as the username and password of a DHIS2 user with the App Management authority.<br/>
You must run `yarn build` before running `yarn deploy`.<br />

See the section about [deploying](https://platform.dhis2.nu/#/scripts/deploy) for more information.

## Learn More

You can learn more about the platform in the [DHIS2 Application Platform Documentation](https://platform.dhis2.nu/).

You can learn more about the runtime in the [DHIS2 Application Runtime Documentation](https://runtime.dhis2.nu/).

To learn React, check out the [React documentation](https://reactjs.org/).
