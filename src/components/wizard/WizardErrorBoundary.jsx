import { Component } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

export default class WizardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3, maxWidth: 720 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Wizard failed to render
            </Typography>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
              {this.state.error?.message || String(this.state.error)}
            </Typography>
          </Alert>
          <Button variant="outlined" onClick={this.handleRetry}>
            Try again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
