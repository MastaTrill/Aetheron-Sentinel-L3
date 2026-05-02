'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const react_1 = __importDefault(require('react'));
const client_1 = __importDefault(require('react-dom/client'));
const index_js_1 = require('@apollo/client/core/index.js');
const index_js_2 = require('@apollo/client/react/index.js');
const App_1 = __importDefault(require('./App'));
require('./index.css');
const client = new index_js_1.ApolloClient({
  link: new index_js_1.HttpLink({
    uri: 'https://api.studio.thegraph.com/query/0960a0b2443269219dd37295eb8c5695/aetheron-sentinel-l-3/v0.1.1',
  }),
  cache: new index_js_1.InMemoryCache(),
});
client_1.default.createRoot(document.getElementById('root')).render(
  <react_1.default.StrictMode>
    <index_js_2.ApolloProvider client={client}>
      <App_1.default />
    </index_js_2.ApolloProvider>
  </react_1.default.StrictMode>
);
