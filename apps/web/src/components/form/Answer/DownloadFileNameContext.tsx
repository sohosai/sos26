import { createContext, type ReactNode, useContext } from "react";
import type { DownloadFileNameContext as DownloadFileNameContextValue } from "../type";

const DownloadFileNameContext = createContext<
	DownloadFileNameContextValue | undefined
>(undefined);

type Props = {
	value: DownloadFileNameContextValue | undefined;
	children: ReactNode;
};

export function DownloadFileNameProvider({ value, children }: Props) {
	return (
		<DownloadFileNameContext.Provider value={value}>
			{children}
		</DownloadFileNameContext.Provider>
	);
}

export function useDownloadFileNameContext() {
	return useContext(DownloadFileNameContext);
}
