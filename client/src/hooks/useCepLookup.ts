import { useState, useCallback, useRef } from "react";

export interface CepResult {
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Hook para busca automática de endereço via CEP (ViaCEP API)
 * 
 * Uso:
 *   const { fetchCep, isLoading, error } = useCepLookup();
 *   // No onChange do campo CEP:
 *   const handleCepChange = (value: string) => {
 *     setCep(value);
 *     fetchCep(value, { setLogradouro, setBairro, setCidade, setUf, setComplemento });
 *   };
 */
export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedRef = useRef<string>("");

  const fetchCep = useCallback(async (
    rawCep: string,
    setters: {
      setLogradouro?: (v: string) => void;
      setEndereco?: (v: string) => void;
      setBairro?: (v: string) => void;
      setCidade?: (v: string) => void;
      setMunicipio?: (v: string) => void;
      setUf?: (v: string) => void;
      setComplemento?: (v: string) => void;
    }
  ) => {
    const cleanCep = rawCep.replace(/\D/g, "");
    
    // Only fetch when we have exactly 8 digits
    if (cleanCep.length !== 8) {
      setError(null);
      return;
    }

    // Don't re-fetch the same CEP
    if (cleanCep === lastFetchedRef.current) return;
    lastFetchedRef.current = cleanCep;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) {
        throw new Error("Erro ao consultar CEP");
      }
      const data: CepResult = await response.json();
      
      if (data.erro) {
        setError("CEP não encontrado");
        return;
      }

      // Fill address fields
      if (data.logradouro) {
        (setters.setLogradouro || setters.setEndereco)?.(data.logradouro);
      }
      if (data.bairro) {
        setters.setBairro?.(data.bairro);
      }
      if (data.localidade) {
        (setters.setCidade || setters.setMunicipio)?.(data.localidade);
      }
      if (data.uf) {
        setters.setUf?.(data.uf);
      }
      if (data.complemento && setters.setComplemento) {
        setters.setComplemento(data.complemento);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao buscar CEP");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    lastFetchedRef.current = "";
    setError(null);
  }, []);

  return { fetchCep, isLoading, error, reset };
}
