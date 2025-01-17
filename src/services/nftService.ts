import { Transaction, VersionedTransaction } from '@solana/web3.js';

interface NFT {
    name: string;
    image: string;
    mint: string;
    value: number;
}

export class NFTService {
    private static async fetchWithConfig(url: string, method: string, body?: any) {
        const config: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetch(url, config);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    static async fetchNFTs(publicKey: string): Promise<NFT[]> {
        const result = await this.fetchWithConfig(process.env.REACT_APP_RPC_URL!, 'POST', {
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAssetsByOwner',
            params: {
                ownerAddress: publicKey,
                page: 1,
                limit: 1000,
                displayOptions: {
                    showFungible: false,
                    showNativeBalance: false,
                },
            },
        });

        if (!result.result?.items) {
            return [];
        }
        console.log('result:', result);

        const nftList = result.result.items
            .filter((item: any) => {
                if (item.compression.compressed === true) return false;

                const uri = item.content?.files?.[0]?.uri || item.content?.json?.image;
                return item.content?.metadata?.name && uri;
            })
            .map((item: any) => ({
                name: item.content.metadata.name,
                image: item.content.files?.[0]?.uri || item.content.json?.image,
                mint: item.id,
                value: 0,
            }));

        console.log(nftList);

        return await this.filterWorthlessNFTs(nftList, publicKey);
        //return nftList;
    }

    static async checkNFTValues(mints: string[]): Promise<Record<string, number>> {
        return await this.fetchWithConfig(`${process.env.CUSTOM_API_URL}`, 'POST', { mints });
    }

    private static async filterWorthlessNFTs(nftList: NFT[], publicKey: string): Promise<NFT[]> {
        const valuableNFTsData = await this.fetchWithConfig(
            `${process.env.REACT_APP_CUSTOM_API_URL}`,
            'POST',
            {
                userWallet: publicKey,
            }
        );
        console.log('valuable NFTs data:', valuableNFTsData);

        // Extraire les mints des NFTs qui ont de la valeur
        const valuableMints = valuableNFTsData;

        // Retourner les NFTs qui ne sont PAS dans la liste des NFTs de valeur
        return nftList.filter((nft) => !valuableMints.includes(nft.mint));
    }

    static async prepareScoopTransaction(
        mints: string[],
        publicKey: string
    ): Promise<VersionedTransaction> {
        const serializedTransaction = await this.fetchWithConfig(
            `${process.env.REACT_APP_CUSTOM_API_URL}/prepare-scoop-transaction`,
            'POST',
            { mints, userWallet: publicKey }
        );
        console.log('response:', serializedTransaction);

        const buffer = Buffer.from(serializedTransaction, 'base64');
        console.log('buffer:', buffer);
        return VersionedTransaction.deserialize(buffer);
    }
}
