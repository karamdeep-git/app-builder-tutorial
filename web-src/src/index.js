import "core-js/stable";
import "regenerator-runtime/runtime";
import ReactDOM from "react-dom";

import Runtime, { init } from "@adobe/exc-app";

import App from "./components/App";
import "./index.css";

window.React = require("react");

try {
  // attempt to load the Experience Cloud Runtime
  require("./exc-runtime");
  // if there are no errors, bootstrap the app in the Experience Cloud Shell
  init(bootstrapInExcShell);
} catch (e) {
  console.log("application not running in Adobe Experience Cloud Shell");
  // fallback mode, run the application without the Experience Cloud Runtime
  bootstrapRaw();
}

function bootstrapRaw() {
  const mockRuntime = { on: () => {} };
  const mockIms = {};

  ReactDOM.render(<App runtime={mockRuntime} ims={mockIms} />, document.getElementById("root"));
}

function bootstrapInExcShell() {
  const runtime = Runtime();

  runtime.on("ready", ({ imsOrg, imsToken, imsProfile }) => {
    runtime.done();
    const ims = {
      profile: imsProfile,
      org: imsOrg,
      token: imsToken,
    };
    ReactDOM.render(<App runtime={runtime} ims={ims} />, document.getElementById("root"));
  });

  runtime.solution = {
    icon: "AdobeExperienceCloud",
    title: "App Builder Tutorial",
    shortTitle: "ABT",
  };
  runtime.title = "App Builder Tutorial";
}
