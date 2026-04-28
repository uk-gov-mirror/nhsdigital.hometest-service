import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import sessionService from "@/lib/services/session-service";
import { backendUrl } from "@/settings";

export type LookupResultsStatus = "idle" | "found" | "not_found" | "error";

export interface AddressResult {
  id: string;
  line1: string;
  line2?: string;
  line3?: string;
  line4?: string;
  town: string;
  postcode: string;
  fullAddress: string;
}

export interface PostcodeLookupContextType {
  postcode: string;
  addresses: AddressResult[];
  selectedAddress: AddressResult | null;
  isLoading: boolean;
  lookupResultsStatus: LookupResultsStatus;
  error: string | null;
  lookupPostcode: (postcode: string) => Promise<void>;
  setSelectedAddress: (address: AddressResult | null) => void;
  clearAddresses: () => void;
}

export const PostcodeLookupContext = createContext<PostcodeLookupContextType | undefined>(
  undefined,
);

interface PostcodeLookupProviderProps {
  children: ReactNode;
}

interface PersistedPostcodeLookupState {
  postcode: string;
  addresses: AddressResult[];
  selectedAddress: AddressResult | null;
  lookupResultsStatus: LookupResultsStatus;
  error: string | null;
}

const defaultPersistedPostcodeLookupState: PersistedPostcodeLookupState = {
  postcode: "",
  addresses: [],
  selectedAddress: null,
  lookupResultsStatus: "idle",
  error: null,
};

function getPersistedPostcodeLookupState(): PersistedPostcodeLookupState {
  return sessionService.rehydratePostcodeLookup<PersistedPostcodeLookupState>(
    defaultPersistedPostcodeLookupState,
  );
}

export const PostcodeLookupProvider: React.FC<PostcodeLookupProviderProps> = ({ children }) => {
  const [persistedState] = useState<PersistedPostcodeLookupState>(getPersistedPostcodeLookupState);
  const [postcode, setPostcode] = useState<string>(persistedState.postcode);
  const [addresses, setAddresses] = useState<AddressResult[]>(persistedState.addresses);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(
    persistedState.selectedAddress,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lookupResultsStatus, setLookupResultsStatus] = useState<LookupResultsStatus>(
    persistedState.lookupResultsStatus,
  );
  const [error, setError] = useState<string | null>(persistedState.error);

  useEffect(() => {
    const isEmptyState =
      postcode === "" &&
      addresses.length === 0 &&
      selectedAddress === null &&
      lookupResultsStatus === "idle" &&
      error === null;

    if (isEmptyState) {
      sessionService.clearPostcodeLookup();
      return;
    }

    sessionService.dehydratePostcodeLookup<PersistedPostcodeLookupState>({
      postcode,
      addresses,
      selectedAddress,
      lookupResultsStatus,
      error,
    });
  }, [postcode, addresses, selectedAddress, lookupResultsStatus, error]);

  const lookupPostcode = useCallback(async (postcodeValue: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setAddresses([]);

    try {
      const url = new URL(`${backendUrl}/postcode-lookup`);
      url.searchParams.append("postcode", postcodeValue);
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Failed to lookup postcode");
      }

      const data = await response.json();
      const foundAddresses = data.addresses || [];
      setAddresses(foundAddresses);
      setPostcode(postcodeValue);
      setLookupResultsStatus(foundAddresses.length > 0 ? "found" : "not_found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAddresses([]);
      setLookupResultsStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAddresses = useCallback((): void => {
    setAddresses([]);
    setSelectedAddress(null);
    setPostcode("");
    setLookupResultsStatus("idle");
    setError(null);
    sessionService.clearPostcodeLookup();
  }, []);

  const value: PostcodeLookupContextType = useMemo(
    () => ({
      postcode,
      addresses,
      selectedAddress,
      isLoading,
      lookupResultsStatus,
      error,
      lookupPostcode,
      setSelectedAddress,
      clearAddresses,
    }),
    [
      postcode,
      addresses,
      selectedAddress,
      isLoading,
      lookupResultsStatus,
      error,
      lookupPostcode,
      setSelectedAddress,
      clearAddresses,
    ],
  );

  return <PostcodeLookupContext.Provider value={value}>{children}</PostcodeLookupContext.Provider>;
};

export const usePostcodeLookup = (): PostcodeLookupContextType => {
  const context = useContext(PostcodeLookupContext);

  if (context === undefined) {
    throw new Error("usePostcodeLookup must be used within a PostcodeLookupProvider");
  }

  return context;
};
