import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { Badge } from "@/components/ui/badge";

interface FuncionarioAvatarHeaderProps {
  nome: string;
  cargo?: string;
  departamento?: string;
  avatarUrl?: string | null;
  onAvatarChange: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
}

export function FuncionarioAvatarHeader({
  nome,
  cargo,
  departamento,
  avatarUrl,
  onAvatarChange,
  disabled = false,
}: FuncionarioAvatarHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 mb-6">
      <div className="flex flex-col items-center text-center space-y-3">
        <AvatarUpload
          name={nome}
          imageUrl={avatarUrl}
          onImageChange={onAvatarChange}
          size="xl"
          disabled={disabled}
        />
        
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white">
            {nome || "Novo Funcionário"}
          </h3>
          
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {cargo && (
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                {cargo}
              </Badge>
            )}
            {departamento && (
              <Badge variant="outline" className="border-white/40 text-white/90">
                {departamento}
              </Badge>
            )}
          </div>
        </div>
        
        <p className="text-purple-200 text-sm">
          Clique na foto para alterar
        </p>
      </div>
    </div>
  );
}
