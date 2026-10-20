# Transformer is a Query Based Compositer

## What is query based compositer

Typically and historically, we have always considered Self-Attention as a query-like component.[^vaswani] With query $q$, attention module computes its "similarity" $s_i$ (actually activity) to each key $k_i$, and output $v$ by compositing $v_i$ with $s_i$ as corresponding strength. Formally, it can be written as:
$$
\begin{align*}
&q = Q(x) = xW_q \\
&K = XW_K, V=XW_V \\
&s = \text{Match}(q,K) \\
&y = \text{Composite}(s,V)
\end{align*}
$$

where $\text{Match}(q,K)=\text{softmax}(\frac{qK^{\top}}{\sqrt{d}})$ and $\text{Composite}(s,V) = sV = \sum(s_i v_i)$. 

We call the the procudure of one $\text{Match}$ as a **query**. So Self-Attention can be seen as a composition with coefficient computed by a **query**. That is what we call *Query Based Compositer*. With small modification, this frame can also be used to describe MHA and GQA.[^gqa]

## FFN is also query based compositer

Not so known to everyone, FFN can also be described by the frame we just form.[^geva] Typically, a 2-layer FFN is formulated as: 
$$
y = \text{FFN}(x) = \sigma(xW_1)W_2
$$
Let's define $K=W_1^{\top}$ and $V=W_2$. The formula above can be rewritten as:
$$
\begin{aligned}
&q = Q(x) = x \\
&s = \text{Match}(q,K) = \sigma(qK^{\top}) = \sigma(xW_1) \\
&y = \text{Composite}(s,V) = sV = sW_2 = \sigma(xW_1)W_2 = \text{FFN}(x)
\end{aligned}
$$
Here $\text{Match}$ function is a little different from that in Self-Attention. But it is still reasonable since it just removes scale factor $\sqrt{d}$ and allow $\text{softmax}$ to be altered by any other activation functions.

## SwiGLU is a 2-key query based compositer

Nowadays we do not use traditional FFNs anymore. Instead, SwiGLU FFN is widely applied in various variants of Transformers.[^shazeer][^palm] Some consider SwiGLU as an activation function. That is misleading. A better way to understand SwiGLU, or more generally GLUs, is to consider them as a **2-key AND** query based compositer.

Typical formula of SwiGLU FFN is:
$$
\begin{aligned}
\text{SwiGLU}(x)=(\sigma (xW_g)\odot (xW_u))W_d
\end{aligned}
$$

Consider $W_g$ as a set of keys $K_g$, $W_u$ another set of keys $K_u$. And $W_d$ as values to be composited $V$. Each value $v_i$ corresponds to 2 keys $k_{g_1}$ and $k_{u_1}$. Then by the frame we designed above, SwiGLU can be described as 
$$
\begin{aligned}
&q = x\\
&K = \{K_g,K_u\} = \{W_g,W_u\}, V=W_d\\
&s = \{s_g,s_u\} = \text{Match}(q,K) = \{\sigma(qK_g),qK_u\} = \{\sigma(xW_g),xW_u\} \\
&y = \text{Composite}(s,V) = (s_g\odot s_u)V=(\sigma (xW_g)\odot (xW_u))W_d
\end{aligned}
$$



## References

[^vaswani]: Vaswani et al., *Attention Is All You Need*, NeurIPS 2017. <https://arxiv.org/abs/1706.03762>
[^gqa]: Ainslie et al., *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints*, EMNLP 2023. <https://arxiv.org/abs/2305.13245>
[^geva]: Geva et al., *Transformer Feed-Forward Layers Are Key-Value Memories*, EMNLP 2021. <https://arxiv.org/abs/2012.14913>
[^shazeer]: Shazeer, *GLU Variants Improve Transformer*, arXiv 2020. <https://arxiv.org/abs/2002.05202>
[^palm]: Chowdhery et al., *PaLM: Scaling Language Modeling with Pathways*, JMLR 2023. <https://arxiv.org/abs/2204.02311>


