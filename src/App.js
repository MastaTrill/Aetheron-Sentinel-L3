"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SentinelStatus_1 = __importDefault(require("./components/SentinelStatus"));
function App() {
    return (<div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Aetheron Sentinel L3</h1>
        <p className="text-gray-500">Autonomous Governance Dashboard</p>
      </header>
      <main>
        <SentinelStatus_1.default />
      </main>
    </div>);
}
exports.default = App;
