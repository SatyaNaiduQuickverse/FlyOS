// components/ui/AlertDialog.tsx
import React, { useState, useEffect, ReactNode, useRef } from 'react';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface AlertDialogContentProps {
  children: ReactNode;
  className?: string;
}

interface AlertDialogHeaderProps {
  children: ReactNode;
}

interface AlertDialogTitleProps {
  children: ReactNode;
}

interface AlertDialogDescriptionProps {
  children: ReactNode;
}

interface AlertDialogFooterProps {
  children: ReactNode;
}

interface AlertDialogActionProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

interface AlertDialogCancelProps {
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ open, onOpenChange, children }) => {
  const [isVisible, setIsVisible] = useState(open);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);
  
  // Handle open state changes
  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);
  
  if (!isVisible) return null;
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {children}
    </div>
  );
};

export const AlertDialogContent: React.FC<AlertDialogContentProps> = ({ children, className = '' }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.focus();
    }
  }, []);
  
  return (
    <div 
      ref={dialogRef}
      className={`bg-slate-900/90 text-white p-8 rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm z-10 max-w-md w-full relative transform transition-all duration-200 ${className}`}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
};

export const AlertDialogHeader: React.FC<AlertDialogHeaderProps> = ({ children }) => (
  <div className="mb-6">{children}</div>
);

export const AlertDialogTitle: React.FC<AlertDialogTitleProps> = ({ children }) => (
  <h3 className="text-xl font-light tracking-wider text-blue-300">{children}</h3>
);

export const AlertDialogDescription: React.FC<AlertDialogDescriptionProps> = ({ children }) => (
  <p className="mt-2 text-gray-300 tracking-wide">{children}</p>
);

export const AlertDialogFooter: React.FC<AlertDialogFooterProps> = ({ children }) => (
  <div className="flex justify-end space-x-4 mt-6">{children}</div>
);

export const AlertDialogAction: React.FC<AlertDialogActionProps> = ({ 
  children, 
  onClick,
  className = ''
}) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 rounded-lg tracking-wider font-light bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors ${className}`}
  >
    {children}
  </button>
);

export const AlertDialogCancel: React.FC<AlertDialogCancelProps> = ({ 
  children = 'CANCEL', 
  onClick,
  className = ''
}) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 rounded-lg tracking-wider font-light bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors ${className}`}
  >
    {children}
  </button>
);

// Export all components
export {
  AlertDialogContent as Content,
  AlertDialogHeader as Header,
  AlertDialogTitle as Title,
  AlertDialogDescription as Description,
  AlertDialogFooter as Footer,
  AlertDialogAction as Action,
  AlertDialogCancel as Cancel,
};