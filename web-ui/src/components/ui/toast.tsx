import * as React from "react"
import { cn } from "../../lib/utils"

interface ToastProps {
  message: string
  type?: "success" | "error" | "info"
  onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ message, type = "info", onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const typeStyles = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800"
  }

  return (
    <div className={cn(
      "fixed top-4 right-4 p-4 border rounded-lg shadow-lg z-50 max-w-sm",
      typeStyles[type]
    )}>
      <div className="flex justify-between items-start">
        <p className="text-sm">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 text-lg leading-none hover:opacity-70"
        >
          ×
        </button>
      </div>
    </div>
  )
}

interface ToastContextType {
  showToast: (message: string, type?: "success" | "error" | "info") => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([])

  const showToast = React.useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}