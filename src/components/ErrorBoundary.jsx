import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Attempting to reload the current route or reset state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-24 h-24 bg-[#F43F5E]/20 rounded-full flex items-center justify-center mb-6 border border-[#F43F5E]/50">
            <AlertTriangle size={48} className="text-[#F43F5E] animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Application Error</h1>
          <p className="text-[#6B7FA8] mb-6 max-w-md">
            The application encountered a critical error. We apologize for the disruption.
          </p>
          
          {this.state.error && (
            <div className="bg-[#1A2235] border border-[#1E2D45] rounded-lg p-4 mb-8 max-w-2xl w-full overflow-auto text-left">
              <code className="text-[#F43F5E] text-xs font-mono-data">
                {this.state.error.toString()}
              </code>
            </div>
          )}

          <button 
            onClick={this.handleReset}
            className="bg-[#1A2235] border border-[#1E2D45] hover:border-[#F59E0B] text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={18} className="text-[#F59E0B]" />
            RELOAD APPLICATION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
