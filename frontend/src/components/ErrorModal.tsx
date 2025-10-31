/**
 * ErrorModal Component
 *
 * Displays user-friendly error messages from the UserError backend system.
 * Separate from logging (logging is for developers, this is for users).
 */

interface UserErrorResponse {
  type: 'user_error';
  severity: 'info' | 'warning' | 'error' | 'critical';
  userMessage: string;
  suggestions: string[];
  field?: string;
  code?: string;
}

interface ErrorModalProps {
  error: UserErrorResponse | null;
  onClose: () => void;
}

export default function ErrorModal({ error, onClose }: ErrorModalProps) {
  if (!error) return null;

  // Icon and colors based on severity
  const getSeverityStyles = () => {
    switch (error.severity) {
      case 'critical':
        return {
          icon: '🚨',
          bgColor: 'bg-red-100 dark:bg-red-950',
          borderColor: 'border-red-300 dark:border-red-800',
          textColor: 'text-red-900 dark:text-red-100',
          buttonBg: 'bg-red-600 hover:bg-red-700',
        };
      case 'error':
        return {
          icon: 'WARNING',
          bgColor: 'bg-red-50 dark:bg-red-950/30',
          borderColor: 'border-red-200 dark:border-red-900',
          textColor: 'text-red-800 dark:text-red-200',
          buttonBg: 'bg-red-600 hover:bg-red-700',
        };
      case 'warning':
        return {
          icon: 'ERROR',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
          borderColor: 'border-yellow-200 dark:border-yellow-900',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
        };
      case 'info':
        return {
          icon: 'ℹ️',
          bgColor: 'bg-blue-50 dark:bg-blue-950/30',
          borderColor: 'border-blue-200 dark:border-blue-900',
          textColor: 'text-blue-800 dark:text-blue-200',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`${styles.bgColor} ${styles.borderColor} border-2 rounded-lg p-6 max-w-md w-full shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">{styles.icon}</div>

          <div className="flex-1">
            <h3 className={`font-semibold text-lg mb-2 ${styles.textColor}`}>
              {error.userMessage}
            </h3>

            {error.suggestions && error.suggestions.length > 0 && (
              <div className={`text-sm ${styles.textColor} space-y-1 mb-4`}>
                {error.suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}

            {error.field && (
              <p className={`text-xs ${styles.textColor} opacity-75 mb-4`}>
                Field: {error.field}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className={`w-full mt-4 ${styles.buttonBg} text-white font-medium py-2.5 rounded-lg transition-colors`}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
