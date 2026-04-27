// Expanded Graph definition for All-India Routes

const RouteGraph = {
    // Adjacency list: node -> [{to, distance, tolls: [], speedLimit}]
    edges: {
        'SXR': [{ to: 'JMU', distance: 260, tolls: [], speedLimit: 60 }],
        'JMU': [{ to: 'SXR', distance: 260, tolls: [], speedLimit: 60 }, { to: 'AMR', distance: 210, tolls: [], speedLimit: 80 }],
        'AMR': [{ to: 'JMU', distance: 210, tolls: [], speedLimit: 80 }, { to: 'CHD', distance: 220, tolls: [], speedLimit: 90 }],
        'CHD': [{ to: 'AMR', distance: 220, tolls: [], speedLimit: 90 }, { to: 'DEL', distance: 240, tolls: ['TP_NH44_1'], speedLimit: 90 }],
        'DDN': [{ to: 'DEL', distance: 250, tolls: [], speedLimit: 80 }],
        
        'DEL': [
            { to: 'CHD', distance: 240, tolls: ['TP_NH44_1'], speedLimit: 90 },
            { to: 'DDN', distance: 250, tolls: [], speedLimit: 80 },
            { to: 'AGR', distance: 230, tolls: ['TP_YAMUNA_EXP'], speedLimit: 120 }, // Yamuna Expressway
            { to: 'JAI', distance: 280, tolls: ['TP_DEL_JAI_1', 'TP_DEL_JAI_2'], speedLimit: 100 }
        ],
        'AGR': [
            { to: 'DEL', distance: 230, tolls: ['TP_YAMUNA_EXP'], speedLimit: 120 },
            { to: 'KAN', distance: 280, tolls: [], speedLimit: 90 },
            { to: 'LKO', distance: 330, tolls: ['TP_AGRA_LKO_EXP'], speedLimit: 120 } // Agra-Lucknow Exp
        ],
        'LKO': [
            { to: 'AGR', distance: 330, tolls: ['TP_AGRA_LKO_EXP'], speedLimit: 120 },
            { to: 'KAN', distance: 90, tolls: [], speedLimit: 80 },
            { to: 'PRY', distance: 200, tolls: [], speedLimit: 90 }
        ],
        'KAN': [
            { to: 'LKO', distance: 90, tolls: [], speedLimit: 80 },
            { to: 'AGR', distance: 280, tolls: [], speedLimit: 90 },
            { to: 'PRY', distance: 210, tolls: [], speedLimit: 90 }
        ],
        'PRY': [
            { to: 'KAN', distance: 210, tolls: [], speedLimit: 90 },
            { to: 'LKO', distance: 200, tolls: [], speedLimit: 90 },
            { to: 'BNS', distance: 120, tolls: [], speedLimit: 80 }
        ],
        'BNS': [
            { to: 'PRY', distance: 120, tolls: [], speedLimit: 80 },
            { to: 'PAT', distance: 250, tolls: [], speedLimit: 80 },
            { to: 'RAN', distance: 400, tolls: [], speedLimit: 80 }
        ],
        'PAT': [
            { to: 'BNS', distance: 250, tolls: [], speedLimit: 80 },
            { to: 'SIL', distance: 450, tolls: [], speedLimit: 80 }
        ],
        'SIL': [
            { to: 'PAT', distance: 450, tolls: [], speedLimit: 80 },
            { to: 'GUW', distance: 430, tolls: [], speedLimit: 70 },
            { to: 'KOL', distance: 580, tolls: [], speedLimit: 80 }
        ],
        'GUW': [
            { to: 'SIL', distance: 430, tolls: [], speedLimit: 70 }
        ],
        'RAN': [
            { to: 'BNS', distance: 400, tolls: [], speedLimit: 80 },
            { to: 'KOL', distance: 400, tolls: [], speedLimit: 80 },
            { to: 'BBS', distance: 450, tolls: [], speedLimit: 80 }
        ],
        
        'JAI': [
            { to: 'DEL', distance: 280, tolls: ['TP_DEL_JAI_2', 'TP_DEL_JAI_1'], speedLimit: 100 },
            { to: 'UDR', distance: 390, tolls: [], speedLimit: 90 },
            { to: 'VAD', distance: 540, tolls: [], speedLimit: 90 }
        ],
        'UDR': [
            { to: 'JAI', distance: 390, tolls: [], speedLimit: 90 },
            { to: 'AMD', distance: 260, tolls: [], speedLimit: 90 }
        ],
        'AMD': [
            { to: 'UDR', distance: 260, tolls: [], speedLimit: 90 },
            { to: 'RJK', distance: 215, tolls: [], speedLimit: 90 },
            { to: 'VAD', distance: 110, tolls: ['TP_NE1'], speedLimit: 100 } // NE1 Expressway
        ],
        'RJK': [{ to: 'AMD', distance: 215, tolls: [], speedLimit: 90 }],
        'VAD': [
            { to: 'AMD', distance: 110, tolls: ['TP_NE1'], speedLimit: 100 },
            { to: 'JAI', distance: 540, tolls: [], speedLimit: 90 },
            { to: 'SRT', distance: 150, tolls: [], speedLimit: 90 },
            { to: 'IND', distance: 340, tolls: [], speedLimit: 80 }
        ],
        'SRT': [
            { to: 'VAD', distance: 150, tolls: [], speedLimit: 90 },
            { to: 'MUM', distance: 280, tolls: ['TP_AMD_MUM_2'], speedLimit: 90 }
        ],
        
        'IND': [
            { to: 'VAD', distance: 340, tolls: [], speedLimit: 80 },
            { to: 'BHU', distance: 190, tolls: [], speedLimit: 80 },
            { to: 'NGP', distance: 440, tolls: [], speedLimit: 80 }
        ],
        'BHU': [
            { to: 'IND', distance: 190, tolls: [], speedLimit: 80 },
            { to: 'JBP', distance: 310, tolls: [], speedLimit: 80 }
        ],
        'JBP': [
            { to: 'BHU', distance: 310, tolls: [], speedLimit: 80 },
            { to: 'RAI', distance: 350, tolls: [], speedLimit: 80 }
        ],
        'RAI': [
            { to: 'JBP', distance: 350, tolls: [], speedLimit: 80 },
            { to: 'NGP', distance: 280, tolls: [], speedLimit: 90 },
            { to: 'BBS', distance: 530, tolls: [], speedLimit: 80 },
            { to: 'VSK', distance: 510, tolls: [], speedLimit: 80 }
        ],
        'NGP': [
            { to: 'IND', distance: 440, tolls: [], speedLimit: 80 },
            { to: 'RAI', distance: 280, tolls: [], speedLimit: 90 },
            { to: 'HYD', distance: 500, tolls: ['TP_NGP_HYD_1'], speedLimit: 100 },
            { to: 'AUR', distance: 500, tolls: ['TP_SAMRUDDHI_EXP'], speedLimit: 120 } // Samruddhi
        ],
        'AUR': [
            { to: 'NGP', distance: 500, tolls: ['TP_SAMRUDDHI_EXP'], speedLimit: 120 },
            { to: 'PUN', distance: 230, tolls: [], speedLimit: 90 },
            { to: 'MUM', distance: 330, tolls: [], speedLimit: 90 }
        ],

        'MUM': [
            { to: 'SRT', distance: 280, tolls: ['TP_AMD_MUM_2'], speedLimit: 90 },
            { to: 'AUR', distance: 330, tolls: [], speedLimit: 90 },
            { to: 'PUN', distance: 150, tolls: ['TP_MUM_PUN_1', 'TP_MUM_PUN_2'], speedLimit: 80 },
            { to: 'NSK', distance: 160, tolls: [], speedLimit: 80 },
            { to: 'GOA', distance: 580, tolls: [], speedLimit: 80 }
        ],
        'NSK': [
            { to: 'MUM', distance: 160, tolls: [], speedLimit: 80 },
            { to: 'PUN', distance: 210, tolls: [], speedLimit: 80 }
        ],
        'PUN': [
            { to: 'MUM', distance: 150, tolls: ['TP_MUM_PUN_2', 'TP_MUM_PUN_1'], speedLimit: 80 },
            { to: 'NSK', distance: 210, tolls: [], speedLimit: 80 },
            { to: 'AUR', distance: 230, tolls: [], speedLimit: 90 },
            { to: 'HUB', distance: 430, tolls: [], speedLimit: 90 },
            { to: 'HYD', distance: 560, tolls: [], speedLimit: 90 }
        ],
        'GOA': [
            { to: 'MUM', distance: 580, tolls: [], speedLimit: 80 },
            { to: 'MNG', distance: 350, tolls: [], speedLimit: 70 },
            { to: 'HUB', distance: 160, tolls: [], speedLimit: 70 }
        ],

        'HYD': [
            { to: 'PUN', distance: 560, tolls: [], speedLimit: 90 },
            { to: 'NGP', distance: 500, tolls: ['TP_NGP_HYD_1'], speedLimit: 100 },
            { to: 'WAR', distance: 145, tolls: [], speedLimit: 90 },
            { to: 'VIJ', distance: 275, tolls: ['TP_HYD_VIJ_1', 'TP_HYD_VIJ_2'], speedLimit: 100 },
            { to: 'BLR', distance: 570, tolls: ['TP_HYD_BLR_1'], speedLimit: 100 }
        ],
        'WAR': [
            { to: 'HYD', distance: 145, tolls: [], speedLimit: 90 },
            { to: 'VIJ', distance: 250, tolls: [], speedLimit: 80 }
        ],
        'VIJ': [
            { to: 'HYD', distance: 275, tolls: ['TP_HYD_VIJ_2', 'TP_HYD_VIJ_1'], speedLimit: 100 },
            { to: 'WAR', distance: 250, tolls: [], speedLimit: 80 },
            { to: 'GUN', distance: 35, tolls: ['TP_VIJ_GUN_1'], speedLimit: 80 },
            { to: 'VSK', distance: 350, tolls: [], speedLimit: 90 }
        ],
        'GUN': [
            { to: 'VIJ', distance: 35, tolls: ['TP_VIJ_GUN_1'], speedLimit: 80 },
            { to: 'NLR', distance: 240, tolls: [], speedLimit: 90 }
        ],
        'NLR': [
            { to: 'GUN', distance: 240, tolls: [], speedLimit: 90 },
            { to: 'TIR', distance: 130, tolls: [], speedLimit: 90 },
            { to: 'CHN', distance: 175, tolls: [], speedLimit: 90 }
        ],
        'TIR': [
            { to: 'NLR', distance: 130, tolls: [], speedLimit: 90 },
            { to: 'BLR', distance: 250, tolls: [], speedLimit: 80 },
            { to: 'CHN', distance: 135, tolls: [], speedLimit: 80 }
        ],
        
        'HUB': [
            { to: 'PUN', distance: 430, tolls: [], speedLimit: 90 },
            { to: 'GOA', distance: 160, tolls: [], speedLimit: 70 },
            { to: 'MNG', distance: 350, tolls: [], speedLimit: 70 },
            { to: 'BLR', distance: 410, tolls: [], speedLimit: 90 }
        ],
        'MNG': [
            { to: 'GOA', distance: 350, tolls: [], speedLimit: 70 },
            { to: 'HUB', distance: 350, tolls: [], speedLimit: 70 },
            { to: 'MYS', distance: 250, tolls: [], speedLimit: 70 },
            { to: 'KOC', distance: 410, tolls: [], speedLimit: 70 }
        ],
        'BLR': [
            { to: 'HYD', distance: 570, tolls: ['TP_HYD_BLR_1'], speedLimit: 100 },
            { to: 'TIR', distance: 250, tolls: [], speedLimit: 80 },
            { to: 'HUB', distance: 410, tolls: [], speedLimit: 90 },
            { to: 'MYS', distance: 145, tolls: ['TP_BLR_MYS_EXP'], speedLimit: 100 },
            { to: 'SLM', distance: 200, tolls: [], speedLimit: 90 },
            { to: 'CHN', distance: 345, tolls: ['TP_CHN_BLR_UP'], speedLimit: 90 }
        ],
        'MYS': [
            { to: 'BLR', distance: 145, tolls: ['TP_BLR_MYS_EXP'], speedLimit: 100 },
            { to: 'MNG', distance: 250, tolls: [], speedLimit: 70 },
            { to: 'CBE', distance: 200, tolls: [], speedLimit: 70 }
        ],
        'SLM': [
            { to: 'BLR', distance: 200, tolls: [], speedLimit: 90 },
            { to: 'CBE', distance: 165, tolls: [], speedLimit: 90 },
            { to: 'CHN', distance: 340, tolls: [], speedLimit: 90 },
            { to: 'MDU', distance: 230, tolls: [], speedLimit: 90 }
        ],
        'CBE': [
            { to: 'MYS', distance: 200, tolls: [], speedLimit: 70 },
            { to: 'SLM', distance: 165, tolls: [], speedLimit: 90 },
            { to: 'KOC', distance: 190, tolls: [], speedLimit: 80 },
            { to: 'MDU', distance: 215, tolls: [], speedLimit: 80 }
        ],
        'KOC': [
            { to: 'MNG', distance: 410, tolls: [], speedLimit: 70 },
            { to: 'CBE', distance: 190, tolls: [], speedLimit: 80 },
            { to: 'TRV', distance: 200, tolls: [], speedLimit: 80 }
        ],
        'TRV': [
            { to: 'KOC', distance: 200, tolls: [], speedLimit: 80 },
            { to: 'MDU', distance: 300, tolls: [], speedLimit: 80 }
        ],
        'MDU': [
            { to: 'TRV', distance: 300, tolls: [], speedLimit: 80 },
            { to: 'CBE', distance: 215, tolls: [], speedLimit: 80 },
            { to: 'SLM', distance: 230, tolls: [], speedLimit: 90 },
            { to: 'CHN', distance: 460, tolls: [], speedLimit: 90 }
        ],
        
        'CHN': [
            { to: 'NLR', distance: 175, tolls: [], speedLimit: 90 },
            { to: 'TIR', distance: 135, tolls: [], speedLimit: 80 },
            { to: 'BLR', distance: 345, tolls: ['TP_CHN_BLR_UP'], speedLimit: 90 },
            { to: 'SLM', distance: 340, tolls: [], speedLimit: 90 },
            { to: 'MDU', distance: 460, tolls: [], speedLimit: 90 }
        ],

        'VSK': [
            { to: 'VIJ', distance: 350, tolls: [], speedLimit: 90 },
            { to: 'RAI', distance: 510, tolls: [], speedLimit: 80 },
            { to: 'BBS', distance: 440, tolls: ['TP_BBS_VSK_1'], speedLimit: 90 }
        ],
        'BBS': [
            { to: 'VSK', distance: 440, tolls: ['TP_BBS_VSK_1'], speedLimit: 90 },
            { to: 'RAI', distance: 530, tolls: [], speedLimit: 80 },
            { to: 'RAN', distance: 450, tolls: [], speedLimit: 80 },
            { to: 'KOL', distance: 440, tolls: [], speedLimit: 90 }
        ],
        'KOL': [
            { to: 'BBS', distance: 440, tolls: [], speedLimit: 90 },
            { to: 'RAN', distance: 400, tolls: [], speedLimit: 80 },
            { to: 'SIL', distance: 580, tolls: [], speedLimit: 80 }
        ]
    }
};

window.RouteGraph = RouteGraph;
