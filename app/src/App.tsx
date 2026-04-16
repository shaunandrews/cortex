import { Routes, Route, Navigate } from 'react-router-dom';
import { Stack, Text, Icon } from '@wordpress/ui';
import { wordpress } from '@wordpress/icons';
import { Agentation } from 'agentation';
import { useAuth } from './auth/AuthContext';
import Callback from './auth/Callback';
import UnauthHome from './views/UnauthHome';
import AuthedHome from './views/AuthedHome';
import ComponentsCatalog from './views/ComponentsCatalog';

function Loading() {
  return (
    <Stack direction="column" align="center" justify="center" gap="md" style={{ height: '100%' }}>
      <Icon icon={wordpress} size={48} />
      <Text variant="body-lg">Loading...</Text>
    </Stack>
  );
}

function Home() {
  const { isAuthed, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  return isAuthed ? <AuthedHome /> : <UnauthHome />;
}

function ComponentsPage() {
  const { isAuthed, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!isAuthed) return <Navigate to="/" replace />;
  return <ComponentsCatalog />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:detailSiteId/:postId" element={<Home />} />
        <Route path="/site/:siteId" element={<Home />} />
        <Route path="/site/:siteId/post/:postId" element={<Home />} />
        <Route path="/site/:siteId/post/:detailSiteId/:postId" element={<Home />} />
        <Route path="/saved" element={<Home />} />
        <Route path="/saved/post/:detailSiteId/:postId" element={<Home />} />
        <Route path="/components" element={<ComponentsPage />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}
