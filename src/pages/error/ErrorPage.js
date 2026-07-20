import React from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowBackRounded, HomeRounded } from '@mui/icons-material';
import { Link } from 'react-router-dom';

export default function ErrorPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        color: 'text.primary',
        bgcolor: 'background.default',
        backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(25,118,210,.16), transparent 42%)',
      }}
    >
      <Container maxWidth="sm">
        <Stack alignItems="center" spacing={2.5} textAlign="center">
          <Typography
            component="p"
            sx={{
              fontSize: { xs: '5rem', sm: '8rem' },
              lineHeight: 0.9,
              fontWeight: 900,
              letterSpacing: '-0.08em',
              color: 'primary.main',
            }}
          >
            404
          </Typography>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>That page is not available</Typography>
            <Typography color="text.secondary">
              The link may be outdated, or your session may no longer be active. Return to the dashboard or sign in again.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button component={Link} to="/app/dashboard" variant="contained" startIcon={<HomeRounded />}>
              Open dashboard
            </Button>
            <Button component={Link} to="/" variant="outlined" startIcon={<ArrowBackRounded />}>
              Back to home
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
