import * as React from "react";
import { Camera, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AvatarUploadProps {
  name?: string;
  imageUrl?: string | null;
  onImageChange: (file: File | null, previewUrl: string | null) => void;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
  lg: "w-20 h-20",
  xl: "w-24 h-24",
};

const iconSizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
};

const getInitials = (name: string): string => {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

export function AvatarUpload({
  name = "",
  imageUrl,
  onImageChange,
  size = "lg",
  className,
  disabled = false,
}: AvatarUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const currentImage = previewUrl || imageUrl;

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG ou WEBP.");
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Tamanho máximo: 2MB.");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      onImageChange(file, result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    onImageChange(null, null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("relative group", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      
      <div
        onClick={handleClick}
        className={cn(
          "cursor-pointer relative",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <Avatar className={cn(sizeClasses[size], "border-4 border-white shadow-lg")}>
          <AvatarImage src={currentImage || undefined} alt={name} />
          <AvatarFallback className="bg-purple-600 text-white font-semibold text-lg">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        {/* Hover overlay */}
        {!disabled && (
          <div className={cn(
            "absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
            sizeClasses[size]
          )}>
            <Camera className={cn("text-white", iconSizeClasses[size])} />
          </div>
        )}
      </div>

      {/* Remove button */}
      {currentImage && !disabled && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleRemove}
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
