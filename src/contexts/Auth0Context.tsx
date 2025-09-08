import React, { createContext, useContext } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

interface Auth0ContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithRedirect: () => void;
  logout: () => void;
  getAccessTokenSilently: () => Promise<string>;
}

const Auth0Context = createContext<Auth0ContextType | undefined>(undefined);

export const useAuth0Context = () => {
  const context = useContext(Auth0Context);
  if (!context) {
    throw new Error('useAuth0Context must be used within Auth0ContextProvider');
  }
  return context;
};

export function Auth0ContextProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    throw new Error('Auth0 domain and client ID must be provided');
  }

  const redirectUri = window.location.origin;

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience,
        scope: "openid profile email"
      }}
      onRedirectCallback={(appState) => {
        navigate(appState?.returnTo || '/dashboard');
      }}
    >
      <Auth0ContextWrapper>{children}</Auth0ContextWrapper>
    </Auth0Provider>
  );
}

function Auth0ContextWrapper({ children }: { children: React.ReactNode }) {
  const auth0 = useAuth0();

  const contextValue: Auth0ContextType = {
    user: auth0.user,
    isAuthenticated: auth0.isAuthenticated,
    isLoading: auth0.isLoading,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: () => auth0.logout({ 
      logoutParams: { 
        returnTo: window.location.origin 
      } 
    }),
    getAccessTokenSilently: auth0.getAccessTokenSilently,
  };

  return (
    <Auth0Context.Provider value={contextValue}>
      {children}
    </Auth0Context.Provider>
  );
}