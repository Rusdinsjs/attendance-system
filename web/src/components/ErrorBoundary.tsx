
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-red-500 bg-slate-900 rounded-xl border border-red-500/20">
                    <h2 className="text-xl font-bold mb-2">Terjadi Kesalahan Aplikasi</h2>
                    <p className="text-slate-400 mb-4">Silakan refresh halaman atau hubungi admin.</p>
                    <pre className="text-xs bg-slate-950 p-4 rounded text-left overflow-auto max-w-full text-red-400">
                        {this.state.error && this.state.error.toString()}
                    </pre>
                    <button
                        className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                        onClick={() => this.setState({ hasError: false, error: null })} // Reset
                    >
                        Coba Lagi
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
