import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core/index.js';
import { ApolloProvider } from '@apollo/client/react/index.js';
import App from './App';
import './index.css';

const client = new ApolloClient({
  link: new HttpLink({
    uri: 'https://api.studio.thegraph.com/query/0960a0b2443269219dd37295eb8c5695/aetheron-sentinel-l-3/v0.1.1',
  }),
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
